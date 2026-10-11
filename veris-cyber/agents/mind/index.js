import { planTask } from '../../src/reasoning.js';

export default async function mind({ message = '', intent = 'task', data = {} } = {}, context = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
    throw new TypeError('mind_invalid_message');
  }
  if (context.signal?.aborted) throw new Error('mind_aborted');
  const prior = Array.isArray(data?.priorInteractions) ? data.priorInteractions.filter(x=>['user','assistant'].includes(x?.role)&&typeof x.content==='string').slice(-10).map(x=>({role:x.role,content:x.content.slice(0,1200)})) : [];
  const evidence = Array.isArray(data?.evidence) ? data.evidence.filter(x => typeof x === 'string').slice(0, 20) : [];
  if(['conversation','question'].includes(intent) && typeof context.generateText==='function' && !data?.researchEvidence?.length){
    const result=await context.generateText({message,history:prior},{signal:context.signal});
    return {status:result.status==='ok'?'model_answer':result.status,answer:result.reply,model:result.model,verified:false,executed:false,evidence};
  }
  if (intent === 'conversation') {
    return { status: 'conversation', answer: 'Estou ouvindo. Como posso ajudar?', contextTurns:prior.length, evidence };
  }
  if (intent === 'question') {
    if (Array.isArray(data?.researchEvidence) && data.researchEvidence.length) {
      const citations = data.researchEvidence.slice(0, 6).filter(s => typeof s?.url === 'string' && typeof s?.excerpt === 'string').map(s => ({ title: s.title, url: s.url, excerpt: s.excerpt }));
      return { status: 'evidence_summary', answer: 'Encontrei fontes relacionadas à pergunta. Os trechos abaixo são evidências preliminares, não uma resposta factual confirmada.', citations, verified: false };
    }
    if (data?.verified === true && typeof data.verifiedAnswer === 'string' && data.verifiedAnswer.trim()) {
      return { status: 'answered', answer: data.verifiedAnswer.trim(), evidence, verified: true };
    }
    return { status: 'needs_evidence', answer: 'Preciso consultar uma fonte confiável antes de responder.', nextAgent: 'research', evidence, verified: false };
  }
  // Planning is advisory and cannot grant execution permissions.
  const plan = planTask(message);
  const next = { phase: 'investigate', suggested_checks: plan.steps.map(step => step.title), execution: 'requires_separate_authorized_tool' };
  return { status: 'planning', answer: 'Objetivo analisado; encaminhando para planejamento.', nextAgent: 'planner', next, executed: false, verified: false, evidence };
}
