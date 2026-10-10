import { randomUUID } from 'node:crypto';
import { TaskQueue } from './task-queue.js';
import { validatePlan, planWaves } from '../../agents/planner/index.js';
import { orchestrate } from '../../src/orchestrator.js';
import senseAgent from '../../agents/sense/index.js';
import mindAgent from '../../agents/mind/index.js';
import plannerAgent from '../../agents/planner/index.js';
import memoryAgent, { storeExperience, findExperiences } from '../../agents/memory/index.js';
import researchAgent from '../../agents/research/index.js';
import { searchMultipleSources } from '../../agents/research/multi-source.js';
import visionAgent from '../../agents/vision/index.js';
import voiceAgent from '../../agents/voice/index.js';
import codeAgent from '../../agents/code/index.js';
import {createCyberService} from '../../agents/cyber/service.js';
import cyberAgent from '../../agents/cyber/index.js';
import actionAgent from '../../agents/action/index.js';
import guardAgent from '../../agents/guard/index.js';
import verifyAgent from '../../agents/verify/index.js';

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
  #queue;
  #researchRetriever;
  #visionAnalyzer;
  #audioTranscriber;
  #speechSynthesizer;
  #codeService;
  #mindResponder;
  #cyberService;
  #actionExecutor;
  #actionAuthorizer;
  constructor({ handlers = {}, maxHistory = 100, concurrency = 3, maxPending = 50, researchRetriever = searchMultipleSources, visionAnalyzer = null, audioTranscriber = null, speechSynthesizer = null, codeService = null, mindResponder=null, actionExecutor=null, actionAuthorizer=null } = {}) {
    if (!Number.isInteger(maxHistory) || maxHistory < 1 || maxHistory > 1000) throw new TypeError('invalid_max_history');
    for(const adapter of [actionExecutor,actionAuthorizer])if(adapter!==null&&typeof adapter!=='function')throw new TypeError('invalid_action_adapter');
    this.#actionExecutor=actionExecutor;this.#actionAuthorizer=actionAuthorizer;
    this.#cyberService=codeService && typeof codeService.authorize==='function'?createCyberService({codeService}):null;
    this.#maxHistory = maxHistory;
    this.#queue = new TaskQueue({ concurrency, maxPending, maxCompleted:maxHistory });
    if (typeof researchRetriever !== 'function') throw new TypeError('invalid_research_retriever');
    this.#researchRetriever = researchRetriever;
    if (visionAnalyzer !== null && typeof visionAnalyzer !== 'function') throw new TypeError('invalid_vision_analyzer');
    this.#visionAnalyzer = visionAnalyzer;
    if (audioTranscriber !== null && typeof audioTranscriber !== 'function') throw new TypeError('invalid_audio_transcriber');
    if (speechSynthesizer !== null && typeof speechSynthesizer !== 'function') throw new TypeError('invalid_speech_synthesizer');
    this.#audioTranscriber = audioTranscriber;
    this.#speechSynthesizer = speechSynthesizer;
    if (codeService !== null && (typeof codeService !== 'object' || typeof codeService.inspect !== 'function')) throw new TypeError('invalid_code_service');
    this.#codeService = codeService;
    if(mindResponder!==null && typeof mindResponder!=='function')throw new TypeError('invalid_mind_responder');
    this.#mindResponder=mindResponder;
    this.register('sense', senseAgent);
    this.register('mind', mindAgent);
    this.register('memory', memoryAgent);
    this.register('planner', plannerAgent);
    this.register('research', researchAgent);
    this.register('vision', visionAgent);
    this.register('voice', voiceAgent);
    this.register('code', codeAgent);
    this.register('cyber', cyberAgent);
    this.register('action', actionAgent);
    this.register('guard', guardAgent);
    this.register('verify', verifyAgent);
    for (const [name, handler] of Object.entries(handlers)) this.register(name, handler);
  }
  register(name, handler) {
    if (!AGENT_NAMES.includes(name) || typeof handler !== 'function') throw new TypeError('invalid_agent');
    this.#handlers.set(name, handler);
    return this;
  }
  get agents() { return AGENT_NAMES.map(name => ({ name, connected: this.#handlers.has(name) })); }
  get capabilities(){
    const available={sense:true,mind:true,memory:true,planner:true,research:true,vision:!!this.#visionAnalyzer,voice:!!this.#audioTranscriber||!!this.#speechSynthesizer,code:!!this.#codeService,cyber:!!this.#cyberService,action:!!this.#actionExecutor&&!!this.#actionAuthorizer,guard:true,verify:true};
    return AGENT_NAMES.map(name=>({name,registered:this.#handlers.has(name),ready:this.#handlers.has(name)&&available[name],...(name==='mind'?{modelReady:!!this.#mindResponder}:{}),...(name==='voice'?{transcriptionReady:!!this.#audioTranscriber,speechReady:!!this.#speechSynthesizer}:{}),state:available[name]?'local_capability':'requires_adapter'}));
  }
  submitAgent(name,input){if(!AGENT_NAMES.includes(name))throw new TypeError('unknown_agent');return this.#queue.submit(()=>this.invokeAgent(name,input));}
  async cyberOperation(request){return this.#cyberService?this.#cyberService.operation(request):{status:'requires_cyber_service',executed:false};}
  async invokeAgent(name,input={}){
    if(!AGENT_NAMES.includes(name))throw new TypeError('unknown_agent');
    if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('invalid_agent_input');
    const data=input.data??{};
    if(!data||typeof data!=='object'||Array.isArray(data))throw new TypeError('invalid_agent_data');
    if(name==='code'||name==='cyber'){
      if(!this.#codeService||typeof this.#codeService.authorize!=='function')return {status:'blocked',reason:'trusted_project_service_required'};
      const check=this.#codeService.authorize({operation:name==='cyber'?'security-audit':data.operation,project:data.project,permissionId:data.permissionId});
      if(!check.allowed)return {status:'blocked',reason:check.reason};
    }
    if(name==='action'){
      if(!this.#actionAuthorizer||!this.#actionExecutor)return {status:'blocked',reason:'trusted_action_adapter_required'};
      const check=await this.#actionAuthorizer(data);if(check?.allowed!==true)return {status:'blocked',reason:check?.reason??'action_not_authorized'};
    }
    return this.#call(name,structuredClone(input),{id:randomUUID()});
  }
  getTask(id) { return this.#queue.get(id) ?? this.#history.get(id) ?? null; }
  get queueStats() { return this.#queue.stats; }
  submit(request) { return this.#queue.submit(() => this.run(request)); }
  cancelQueued(id) { return this.#queue.cancel(id); }
  async processVoice(data) {
    const task = { id: randomUUID(), trace: [] };
    const response = await this.#call('voice', { data }, task);
    if (response.status !== 'ok') return { status: 'error', error: response.error };
    if (response.result?.status !== 'transcribed') return response.result;
    const request = await this.run({ message: response.result.text, mode: 'informational' });
    return { status: 'processed', transcript: response.result.text, taskId: request.id, answer: request.answer ?? null, taskStatus: request.status };
  }
  async speak(text) {
    const response = await this.#call('voice', { data: { operation: 'synthesize', text } }, { id: randomUUID() });
    return response.status === 'ok' ? response.result : { status: 'error', error: response.error };
  }
  // CODE access goes through CORE; host-owned adapters enforce project allowlists and approvals.
  async codeOperation({ operation, project, instruction, proposal, proposalId, approval, approvalId, reviewReference, options, permissionId } = {}) {
    if (!this.#codeService) return { status: 'requires_code_service', executed: false };
    if (operation === 'inspect') return this.#codeService.inspect(project, permissionId);
    if (operation === 'security-audit') return this.#codeService.securityAudit(project, permissionId);
    if (operation === 'propose') return this.#codeService.propose(project, instruction, options, permissionId);
    if (operation === 'stage') return this.#codeService.stage(project, proposalId ?? proposal, approvalId ?? approval, permissionId);
    if (operation === 'describe' && typeof this.#codeService.describe === 'function') return this.#codeService.describe(project, reviewReference, permissionId);
    if (operation === 'rollback' && typeof this.#codeService.rollback === 'function') return this.#codeService.rollback(project, reviewReference, approvalId, permissionId);
    if (operation === 'test') return this.#codeService.test(project, reviewReference, approval, permissionId);
    if (operation === 'review') return this.#codeService.review(project, reviewReference, approval, permissionId);
    return { status: 'unsupported_code_operation', executed: false };
  }
  async rememberExperience(experience) { return storeExperience(experience); }
  async recallExperiences(query) { return findExperiences(query); }
  #save(task) {
    this.#history.set(task.id, task);
    if (this.#history.size > this.#maxHistory) this.#history.delete(this.#history.keys().next().value);
    return task;
  }
  async #call(name, input, task) {
    const handler = this.#handlers.get(name);
    if (!handler) return { status: 'unavailable', agent: name };
    const started = Date.now();
    const controller = new AbortController();
    // Local speech engines can take longer than conversational agents on CPU.
    const timer = setTimeout(() => controller.abort(), name === 'voice' ? 120000 : name==='mind' && this.#mindResponder ? 65000 : name==='research' ? 30000 : TIMEOUT_MS);
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => handler(Object.freeze({ ...input }), { signal: controller.signal, taskId: task.id, ...(name === 'mind' && this.#mindResponder ? {generateText:this.#mindResponder} : {}), ...(name === 'cyber' && this.#cyberService ? {cyberOperation:data=>this.cyberOperation(data)} : {}), ...(name==='action' && this.#actionExecutor ? {executeAction:async(request,options)=>{const check=await this.#actionAuthorizer?.(request.data);return check?.allowed===true?this.#actionExecutor(request,options):{status:'blocked',reason:'action_not_authorized',executed:false};}} : {}), ...(name === 'code' && this.#codeService ? {codeOperation: data => this.codeOperation(data)} : {}), ...(name === 'guard' && this.#actionAuthorizer ? {checkActionPermission:this.#actionAuthorizer} : {}), ...(name === 'guard' && typeof this.#codeService?.authorize === 'function' ? {checkCodePermission: request => this.#codeService.authorize(request)} : {}), ...(name === 'research' ? { retrieve: this.#researchRetriever } : {}), ...(name === 'vision' && this.#visionAnalyzer ? { analyzeImages: this.#visionAnalyzer } : {}), ...(name === 'voice' && this.#audioTranscriber ? { transcribeAudio: this.#audioTranscriber } : {}), ...(name === 'voice' && this.#speechSynthesizer ? { synthesizeSpeech: this.#speechSynthesizer } : {}) })),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('agent_timeout')), { once: true }))
      ]);
      if (result === undefined) throw new Error('empty_agent_response');
      return { status: 'ok', agent: name, result, durationMs: Date.now()-started, attempts: 1 };
    } catch (error) {
      return { status: 'error', agent: name, error: errorText(error), durationMs: Date.now()-started, attempts: 1 };
    } finally { clearTimeout(timer); }
  }
  async run({ message, scope = '', authorized = false, mode = 'auto', data = {} } = {}) {
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) throw new TypeError('message_required');
    if (typeof scope !== 'string' || scope.length > 1000 || typeof authorized !== 'boolean') throw new TypeError('invalid_scope');
    if (!['auto','informational'].includes(mode) || data === null || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('invalid_options');
    const task = { id: randomUUID(), message, scope, status: 'running', trace: [], createdAt: new Date().toISOString(), completedAt: null };
    const record = (name, response) => { task.trace.push({ agent: name, status: response.status, durationMs: response.durationMs ?? null, attempts: response.attempts ?? 1 }); return response; };
    try {
      // The existing deterministic orchestrator provides a safe baseline when specialized agents are not connected.
      const baseline = orchestrate({ message, scope, authorized });
      task.baseline = baseline;
      const sense = record('sense', await this.#call('sense', { message, data }, task));
      const intent = sense.status === 'ok' && sense.result?.intent === 'question' ? 'question' :
        sense.status === 'ok' && sense.result?.intent === 'task' ? 'task' :
        sense.status === 'ok' && sense.result?.intent === 'conversation' ? 'conversation' :
        baseline.mode === 'question' || baseline.mode === 'memory_fast_path' ? 'question' : 'task';
      const routedData = { ...data, requestedAgent: data.requestedAgent ?? sense.result?.requestedAgent };
      const memory = record('memory', await this.#call('memory', { message, intent, data: routedData }, task));
      // Experience retrieval is advisory, scoped to the explicitly named project.
      if (typeof scope === 'string' && scope.trim() && typeof routedData.project === 'string' && routedData.project.trim()) {
        try {
          const experiences = await this.recallExperiences({ scope, project: routedData.project, limit: 5 });
          task.experienceContext = Array.isArray(experiences) ? experiences.filter(item => item?.verified === true).slice(0, 5) : [];
        } catch (error) { task.memoryWarning = errorText(error); task.experienceContext = []; }
      }
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
        if (intent === 'question' && (routedData.requestedAgent === 'research' || Array.isArray(routedData.sources))) {
          const research = record('research', await this.#call('research', { instruction: message, data: routedData }, task));
          task.research = research.status === 'ok' ? research.result : { status: research.status, error: research.error };
          if (research.status === 'ok' && research.result?.status === 'evidence_collected') {
            // Verification and summarization read the same evidence independently.
            const [verification, mind] = await Promise.all([
              this.#call('verify', { research: research.result }, task),
              this.#call('mind', { message, intent: 'question', data: { ...routedData, researchEvidence: research.result.evidence } }, task)
            ]);
            record('verify', verification);
            record('mind', mind);
            task.researchReview = verification.status === 'ok' ? verification.result : { status: 'error', error: verification.error };
            task.answer = mind.status === 'ok' ? mind.result?.answer : 'Fontes coletadas; resumo indisponível.';
            task.citations = mind.status === 'ok' ? mind.result?.citations ?? [] : [];
            task.status = 'needs_verification';
            task.verified = false;
            return task;
          }
        }
        // Planning and response generation are independent for informational tasks.
        const informationalPlan = intent === 'task' && mode === 'informational';
        if (informationalPlan && task.experienceContext?.length) routedData.priorVerifiedExperiences = task.experienceContext.map(x=>({summary:x.summary,outcome:x.outcome}));
        const [mindResponse, plannerResponse] = await Promise.all([
          this.#call('mind', { message, intent, data: routedData }, task),
          informationalPlan ? this.#call('planner', { message, scope, data: routedData }, task) : Promise.resolve(null)
        ]);
        const mind = record('mind', mindResponse);
        if (informationalPlan) {
          const planner = record('planner', plannerResponse);
          const steps=planner.status==='ok' && Array.isArray(planner.result?.steps)?planner.result.steps:[];
          task.plan={steps,suggestedChecks:mind.result?.next?.suggested_checks??[],requiresSelection:planner.result?.requiresSelection??true};
          task.answer=steps.length?'Plano preparado para '+steps.map(s=>s.agent).join(', ')+'.\n'+steps.map((s,i)=>(i+1)+'. '+s.instruction).join('\n'):'Preciso identificar o agente e os detalhes do objetivo para preparar o plano.';
          task.status=steps.length?'planned':'needs_plan_details';task.executed=false;task.verified=false;
          return task;
        }
        task.answer = mind.status === 'ok' && typeof mind.result?.answer === 'string' ? mind.result.answer :
          intent === 'question' ? baseline.answer : 'Posso conversar e ajudar a esclarecer seu pedido. Nenhuma ação foi executada.';
        task.status = 'answered';
        return task;
      }
      // Guard is mandatory before dispatching any task to an execution-capable agent.
      if (authorized !== true || !scope.trim()) {
        task.status = 'blocked'; task.reason = 'explicit_scope_and_authorization_required'; return task;
      }
      const guard = record('guard', await this.#call('guard', { message, scope, authorized, data: routedData }, task));
      if (guard.status !== 'ok' || guard.result?.allowed !== true) {
        task.status = 'blocked'; task.reason = 'guard_approval_required'; return task;
      }
      const planner = record('planner', await this.#call('planner', { message, scope, data: routedData }, task));
      if (planner.status !== 'ok' || !Array.isArray(planner.result?.steps)) {
        task.status = 'needs_planner'; return task;
      }
      const steps = planner.result.steps;
      if (planner.result.requiresSelection || steps.length === 0) { task.status = 'needs_plan_details'; task.reason = planner.result.reason ?? 'empty_plan'; return task; }
      let waves, validatedSteps;
      try {
        validatedSteps = validatePlan(steps);
        waves = planWaves(validatedSteps, 3);
      } catch (error) { task.status = 'invalid_plan'; task.reason = errorText(error); return task; }
      // Execution-capable agents remain sequential, with existing early-return review gates.
      // Parallel waves are currently planning metadata only, never implicit execution approval.
      task.plan = { steps: validatedSteps, waves };
      task.steps = [];
      // Bounded recovery: retry only failed read-only agents. Never replay actions,
      // code changes, or security operations automatically.
      const callPlanned = async (step, dependencies) => {
        const input = { instruction: step.instruction, scope, data: {
          ...routedData, dependencies: Object.fromEntries(step.dependsOn.map(id => [id, dependencies.get(id)?.result ?? null]))
        } };
        const first = await this.#call(step.agent, input, task);
        if (!['research', 'vision'].includes(step.agent) || first.status !== 'error') return first;
        const second = await this.#call(step.agent, input, task);
        task.recovery ??= [];
        task.recovery.push({ stepId: step.id, agent: step.agent, strategy: 'retry_once_read_only', recovered: second.status === 'ok' });
        return { ...second, attempts: 2, durationMs: (first.durationMs ?? 0) + (second.durationMs ?? 0) };
      };
      // Execute independent read-only research/vision steps concurrently within each wave.
      // Side-effecting agents retain the original sequential approval/review path.
      const completed = new Map();
      for (const wave of waves) {
        const batch = wave.map(id => validatedSteps.find(step => step.id === id));
        const independent = batch.every(step => ['research', 'vision'].includes(step.agent));
        if (independent) {
          const responses = await Promise.all(batch.map(step => callPlanned(step, completed)));
          for (let i = 0; i < batch.length; i++) {
            const step = batch[i], response = record(step.agent, responses[i]);
            const outcome = { id: step.id, agent: step.agent, ...response };
            task.steps.push(outcome);
            completed.set(step.id, outcome);
            if (response.status !== 'ok' || response.result?.status === 'blocked' || response.result?.status?.startsWith('requires_')) {
              task.status = 'incomplete'; task.reason = 'dependency_step_failed'; return task;
            }
          }
          continue;
        }
        for (const step of batch) {
        if (ACTION_AGENTS.has(step.agent) && guard.result?.allowExecution !== true) {
          task.status = 'approval_required'; task.reason = 'execution_not_approved'; return task;
        }
        const response = record(step.agent, await callPlanned(step, completed));
        const outcome = { id: step.id, agent: step.agent, ...response };
        task.steps.push(outcome);
        completed.set(step.id, outcome);
        if(step.agent==='action' && response.status==='ok'){
          const result=response.result;task.action=result;task.executed=result.executed===true;task.verified=result.verified===true&&task.executed;
          task.status=task.verified?'completed':result.status==='blocked'?'blocked':'unverified';
          task.answer=result.status==='note_created'?'Nota criada no projeto autorizado.':result.status==='file_read'?'Arquivo lido.':result.status==='files_listed'?'Arquivos permitidos listados.':'A ferramenta não confirmou a conclusão da tarefa.';
          return task;
        }
        if(step.agent==='code' && response.status==='ok' && this.#codeService && typeof routedData.project==='string'){
          const result=response.result;
          task.executed=result.executed===true;task.verified=false;
          if(result.status==='proposal_ready'){task.proposal=result;task.status='awaiting_approval';task.answer='Proposta de código preparada. Revise os arquivos e aprove localmente antes de criar a cópia.';return task;}
          if(result.status==='staged_for_review'){task.reviewReference=result.reviewReference;task.status='awaiting_review';task.answer='Cópia criada para revisão; o projeto original foi preservado.';return task;}
          if(['approval_required','task_permission_required','path_out_of_scope','proposal_not_available'].includes(result.status)){task.status='blocked';task.reason=result.status;return task;}
          task.code=result;task.status=result.status;return task;
        }
        if (response.status !== 'ok' || response.result?.status === 'blocked' || response.result?.status?.startsWith('requires_')) { task.status = 'incomplete'; return task; }
        }
      }
      const verification = record('verify', await this.#call('verify', { message, steps: task.steps, scope }, task));
      task.verified = verification.status === 'ok' && verification.result?.verified === true;
      task.status = task.verified ? 'completed' : 'unverified';
      if (task.verified === true && typeof data.project === 'string' && data.project.trim() && scope.trim()) {
        try { await this.rememberExperience({ scope, project: data.project, summary: message, outcome: 'success', verified: true, source: 'verify', taskId: task.id }); }
        catch (error) { task.memoryWarning = errorText(error); }
      }
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
