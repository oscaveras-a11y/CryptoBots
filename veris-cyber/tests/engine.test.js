import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSecurity } from '../src/engine.js';

test('requires scope and authorization', () => {
  assert.throws(() => analyzeSecurity({ source: 'eval(x)', scope: 'lab', authorized: false }));
  assert.throws(() => analyzeSecurity({ source: 'eval(x)', authorized: true }));
});

test('prioritizes critical findings and returns bounded score', () => {
  const result = analyzeSecurity({ source: 'eval(x);\nconst options = { rejectUnauthorized: false };', filename: 'app.js', scope: 'owned sample', authorized: true });
  assert.equal(result.findings[0].severity, 'critical');
  assert.equal(result.summary.total, 2);
  assert.ok(result.risk_score > 0 && result.risk_score <= 100);
  assert.equal(result.analysis_type, 'static_heuristic');
});

test('never returns a hardcoded credential value', () => {
  const result = analyzeSecurity({ source: "const password = 'supersecret123456';", scope: 'sample', authorized: true });
  assert.equal(JSON.stringify(result).includes('supersecret123456'), false);
});
