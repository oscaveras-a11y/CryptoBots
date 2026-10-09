import { randomUUID } from 'node:crypto';
import { orchestrate } from '../../src/orchestrator.js';

export const AGENT_NAMES = Object.freeze(['sense','mind','memory','planner','research','vision','voice','code','cyber','action','guard','verify']);
const MAX_MESSAGE = 4000;
const TIMEOUT_MS = 8000;
const ACTION_AGENTS = new Set(['action','code','cyber']);
const normalize = value => value.trim().toLocaleLowerCase('pt-BR').replace(/\\s+/g, ' ');
const errorText = error => error instanceof Error ? error.message : String(error);

export class VerisCore {
  #handlers = new Map();
  #history = new Map();
  #maxHistory;
  constructor({ handlers = {}, maxHistory = 100 } = {}) {
    if (!Number.isInteger(maxHistory) || maxHistory < 1 || maxHistory > 1000) throw new TypeError('invalid_max_history');
    this.#maxHistory = maxHistory;
    for (const [name, handler] of Object.entries(handlers)) this.register(name, handler);
  }
  register(name, handler) {
    if (!AGENT_NAMES.includes(name) || typeof handler !== 'function') throw new TypeError('invalid_agent');
    this.#handlers.set(name, handler);
    return this;
  }
  get agents() { return AGENT_NAMES.map(name => ({ name, connected: this.#handlers.has(name) })); }
  getTask(id) { return this.#history.get(id) ?? null; }
  #save(task) {
    this.#history.set(task.id, task);
    if (this.#history.size > this.#maxHistory) this.#history.delete(this.#history.keys().next().value);
    return task;
  }
  async #call(name, input, task) {
    const handler = this.#handlers.get(name);
    if (!handler) return { status: 'unavailable', agent: name };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => handler(Object.freeze({ ...input }), { signal: controller.signal, taskId: task.id })),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('agent_timeout')), { once: true }))
      ]);
      if (result === undefined) throw new Error('empty_agent_response');
      return { status: 'ok', agent: name, result };
    } catch (error) {
      return { status: 'error', agent: name, error: errorText(error) };
    } finally { clearTimeout(timer); }
  }
  async run({ message, scope = '', authorized = false, mode = 'auto', data = {} } = {}) {
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) throw new TypeError('message_required');
    if (typeof scope !== 'string' || scope.length > 1000 || typeof authorized !== 'boolean') throw new TypeError('invalid_scope');
    if (!['auto','informational'].includes(mode) || data === null || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('invalid_options');
    const task = { id: randomUUID(), message, scope, status: 'running', trace: [], createdAt: new Date().toISOString(), completedAt: null };
    const record = (name, response) => { task.trace.push({ agent: name, status: response.status }); return response; };
    try {
      // The existing deterministic orchestrator provides a safe baseline when specialized agents are not connected.
      const baseline = orchestrate({ message, scope, authorized });
      task.baseline = baseline;
      const sense = record('sense', await this.#call('sense', { message, data }, task));
      const intent = sense.status === 'ok' && sense.result?.intent === 'question' ? 'question' :
        sense.status === 'ok' && sense.result?.intent === 'task' ? 'task' :
        sense.status === 'ok' && sense.result?.intent === 'conversation' ? 'conversation' :
        baseline.mode === 'question' || baseline.mode === 'memory_fast_path' ? 'question' : 'task';
      const memory = record('memory', await this.#call('memory', { message, intent, data }, task));
      if (intent === 'question' && memory.status === 'ok' && memory.result?.verified === true && typeof memory.result.answer === 'string') {
        task.answer = memory.result.answer;
        task.status = 'answered';
        return task;
      }
      if (intent === 'question' && baseline.mode === 'memory_fast_path') {
        task.answer = baseline.answer;
        task.status = 'answered';
        return task;
      }
      if (intent === 'question' || intent === 'conversation' || mode === 'informational') {
        const mind = record('mind', await this.#call('mind', { message, intent, data }, task));
        task.answer = mind.status === 'ok' && typeof mind.result?.answer === 'string' ? mind.result.answer :
          intent === 'question' ? baseline.answer : 'Posso conversar e ajudar a esclarecer seu pedido. Nenhuma ação foi executada.';
        task.status = 'answered';
        return task;
      }
      // Guard is mandatory before dispatching any task to an execution-capable agent.
      if (authorized !== true || !scope.trim()) {
        task.status = 'blocked'; task.reason = 'explicit_scope_and_authorization_required'; return task;
      }
      const guard = record('guard', await this.#call('guard', { message, scope, authorized, data }, task));
      if (guard.status !== 'ok' || guard.result?.allowed !== true) {
        task.status = 'blocked'; task.reason = 'guard_approval_required'; return task;
      }
      const planner = record('planner', await this.#call('planner', { message, scope, data }, task));
      if (planner.status !== 'ok' || !Array.isArray(planner.result?.steps)) {
        task.status = 'needs_planner'; return task;
      }
      const steps = planner.result.steps;
      if (steps.length > 12 || steps.some(s => !s || !AGENT_NAMES.includes(s.agent) || typeof s.instruction !== 'string' || s.instruction.length > 1000)) {
        task.status = 'invalid_plan'; return task;
      }
      task.steps = [];
      for (const step of steps) {
        if (ACTION_AGENTS.has(step.agent) && guard.result?.allowExecution !== true) {
          task.status = 'approval_required'; task.reason = 'execution_not_approved'; return task;
        }
        const response = record(step.agent, await this.#call(step.agent, { instruction: step.instruction, scope, data }, task));
        task.steps.push({ agent: step.agent, ...response });
        if (response.status !== 'ok') { task.status = 'incomplete'; return task; }
      }
      const verification = record('verify', await this.#call('verify', { message, steps: task.steps, scope }, task));
      task.verified = verification.status === 'ok' && verification.result?.verified === true;
      task.status = task.verified ? 'completed' : 'unverified';
      return task;
    } catch (error) {
      task.status = 'error'; task.error = errorText(error); return task;
    } finally {
      task.completedAt = new Date().toISOString();
      this.#save(task);
    }
  }
}

export const verisCore = new VerisCore();
