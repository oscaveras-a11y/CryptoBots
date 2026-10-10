import test from 'node:test';
import assert from 'node:assert/strict';
import { createReasoningSession, addEvidence, nextReasoningStep } from '../src/native-reasoning.js';

test('creates native hypotheses without external AI', () => {
  const session = createReasoningSession({ objective: 'verificar login e permissões', scope: 'laboratório próprio', authorized: true });
  assert.equal(session.hypotheses[0].id, 'auth');
  assert.equal(session.execution, 'none');
  assert.equal(nextReasoningStep(session).phase, 'investigate');
});

test('updates conclusions from evidence without mutating original session', () => {
  const session = createReasoningSession({ objective: 'revisar HTTPS', scope: 'meu código', authorized: true });
  const updated = addEvidence(session, { hypothesisId: 'tls', observation: 'Certificado validado', supports: false, source: 'revisão manual' });
  assert.equal(session.hypotheses[0].status, 'unverified');
  assert.equal(updated.hypotheses[0].status, 'not_supported');
  assert.equal(nextReasoningStep(updated).phase, 'report');
});

test('rejects unauthorized scope and unsupported evidence', () => {
  assert.throws(() => createReasoningSession({ objective: 'revisar servidor', scope: 'produção', authorized: false }));
  const session = createReasoningSession({ objective: 'revisar servidor', scope: 'lab', authorized: true });
  assert.throws(() => addEvidence(session, { hypothesisId: 'exposure', observation: 'teste', supports: 'yes', source: 'lab' }));
});
