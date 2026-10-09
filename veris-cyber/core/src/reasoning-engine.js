import { createReasoningSession, addEvidence, nextReasoningStep } from '../../src/native-reasoning.js';

/**
 * Motor deliberativo do VERIS CORE.
 * Planeja verificações e revisa hipóteses sem executar ações no sistema.
 * Evidências devem ser fornecidas por ferramentas externas autorizadas.
 */
export class ReasoningEngine {
  constructor({ maxIterations = 12 } = {}) {
    if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 100) throw new TypeError('invalid_iterations');
    this.maxIterations = maxIterations;
  }
  start({ objective, scope, authorized }) {
    const session = createReasoningSession({ objective, scope, authorized });
    return { ...session, iterations: 0, history: [] };
  }
  evaluate(session, evidence) {
    if (!session || !Number.isInteger(session.iterations)) throw new TypeError('invalid_session');
    if (session.iterations >= this.maxIterations) throw new Error('reasoning_iteration_limit');
    const updated = addEvidence(session, evidence);
    return {
      ...updated,
      iterations: session.iterations + 1,
      history: [...session.history, {
        hypothesisId: evidence.hypothesisId,
        source: evidence.source,
        supports: evidence.supports,
        at: new Date().toISOString()
      }]
    };
  }
  next(session) {
    if (!session || !Number.isInteger(session.iterations)) throw new TypeError('invalid_session');
    if (session.iterations >= this.maxIterations) return { phase: 'stopped', reason: 'iteration_limit' };
    return nextReasoningStep(session);
  }
  report(session) {
    const next = this.next(session);
    return {
      objective: session.objective,
      phase: next.phase,
      hypotheses: session.hypotheses.map(({ id, statement, status, confidence, evidence }) =>
        ({ id, statement, status, evidenceCount: evidence.length, consistencyScore: confidence })),
      iterations: session.iterations,
      limitations: session.limitations,
      verified: false,
      execution: 'none'
    };
  }
}
export const reasoningEngine = new ReasoningEngine();
