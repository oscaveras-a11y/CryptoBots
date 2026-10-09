import { createReasoningSession, nextReasoningStep } from '../../src/native-reasoning.js';

export default async function mind({ message = '', intent = 'task', data = {} } = {}, context = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
    throw new TypeError('mind_invalid_message');
  }
  if (context.signal?.aborted) throw new Error('mind_aborted');
  const evidence = Array.isArray(data?.evidence) ? data.evidence.filter(x => typeof x === 'string').slice(0, 20) : [];
  if (intent === 'conversation') {
    return { status: 'conversation', answer: 'Estou ouvindo. Como posso ajudar?', evidence };
  }
  if (intent === 'question') {
    if (data?.verified === true && typeof data.verifiedAnswer === 'string' && data.verifiedAnswer.trim()) {
      return { status: 'answered', answer: data.verifiedAnswer.trim(), evidence, verified: true };
    }
    return { status: 'needs_evidence', answer: 'Preciso consultar uma fonte confiável antes de responder.', nextAgent: 'research', evidence, verified: false };
  }
  const session = createReasoningSession({ objective: message, scope: '', authorized: false });
  const next = nextReasoningStep(session);
  return { status: 'planning', answer: 'Objetivo analisado; encaminhando para planejamento.', nextAgent: 'planner', next, executed: false, verified: false, evidence };
}
