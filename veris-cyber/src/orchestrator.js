import { createHash } from 'node:crypto';
import { createReasoningSession, nextReasoningStep } from './native-reasoning.js';

// Native multi-agent orchestration. Agents are independently testable modules;
// this implementation does not pretend each agent is a separately trained LLM.
const KNOWLEDGE = new Map([
  ['o que é veris ciber', 'VERIS CIBER é um projeto de assistente multiagente com foco em segurança e automação autorizada.'],
  ['quais agentes você tem', 'Tenho os módulos Sense, Memory, Mind, Guard, Action e Verify.']
]);
const cache = new Map();
const CACHE_LIMIT = 100;

function normalize(input) { return input.trim().toLocaleLowerCase('pt-BR').replace(/[?!.]+$/g, '').trim(); }
function fingerprint(input) { return createHash('sha256').update(input).digest('hex'); }

export const agents = Object.freeze({
  sense: {
    name: 'VERIS Sense',
    run(request) {
      const normalized = normalize(request);
      const isQuestion = /^(o que|quem|qual|quais|como|por que|porque|quando|onde)\b/.test(normalized) || request.trim().endsWith('?');
      return { normalized, intent: isQuestion ? 'question' : 'task', original: request };
    }
  },
  memory: {
    name: 'VERIS Memory',
    run(perception) {
      // Cache only static informational answers; never cache an action as executed.
      const key = fingerprint(perception.normalized);
      return { key, answer: perception.intent === 'question' ? cache.get(key) ?? KNOWLEDGE.get(perception.normalized) ?? null : null };
    }
  },
  mind: {
    name: 'VERIS Mind',
    run(perception, context) {
      if (perception.intent === 'question') return { type: 'answer', text: 'Ainda não tenho uma resposta comprovada para essa pergunta. Preciso consultar uma fonte ou modelo habilitado.' };
      const session = createReasoningSession({ objective: perception.original, scope: context.scope, authorized: context.authorized });
      return { type: 'plan', session, next: nextReasoningStep(session) };
    }
  },
  guard: {
    name: 'VERIS Guard',
    run(context) {
      if (context.authorized !== true || typeof context.scope !== 'string' || !context.scope.trim()) return { allowed: false, reason: 'explicit_scope_and_authorization_required' };
      return { allowed: true, reason: 'planning_only_no_external_execution' };
    }
  },
  action: {
    name: 'VERIS Action',
    run(plan) {
      return { status: 'not_executed', reason: 'No external tool is connected or approved.', proposed: plan.next ?? null };
    }
  },
  verify: {
    name: 'VERIS Verify',
    run(action) {
      return { verified: false, execution: action.status, note: 'No external operation was performed; nothing can be claimed as completed.' };
    }
  }
});

export function orchestrate({ message, scope = '', authorized = false } = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new TypeError('message_required');
  const trace = [];
  const sense = agents.sense.run(message);
  trace.push('sense');
  const memory = agents.memory.run(sense);
  trace.push('memory');
  if (memory.answer !== null) {
    return { mode: 'memory_fast_path', answer: memory.answer, trace, execution: 'none', verified: false };
  }
  if (sense.intent === 'question') {
    const response = agents.mind.run(sense, { scope, authorized });
    trace.push('mind');
    // No fabricated knowledge; future knowledge tools or LLM can be plugged in here.
    return { mode: 'question', answer: response.text, trace, execution: 'none', verified: false };
  }
  const guard = agents.guard.run({ scope, authorized });
  trace.push('guard');
  if (!guard.allowed) return { mode: 'blocked', reason: guard.reason, trace, execution: 'none', verified: false };
  const plan = agents.mind.run(sense, { scope, authorized });
  trace.push('mind');
  const action = agents.action.run(plan);
  trace.push('action');
  const verification = agents.verify.run(action);
  trace.push('verify');
  return { mode: 'planned', plan, action, verification, trace, execution: 'none', verified: false };
}

export function rememberVerifiedAnswer(question, answer) {
  if (typeof question !== 'string' || !question.trim() || question.length > 4000 || typeof answer !== 'string' || !answer.trim() || answer.length > 4000) throw new TypeError('invalid_memory');
  const normalized = normalize(question);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(fingerprint(normalized), answer.trim());
  return { stored: true, persistence: 'process_memory_only' };
}
