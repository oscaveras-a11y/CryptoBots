import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate, rememberVerifiedAnswer } from '../src/orchestrator.js';

test('reuses known informational answers and skips unnecessary agents', () => {
  const result = orchestrate({ message: 'O que é VERIS CIBER?' });
  assert.equal(result.mode, 'memory_fast_path');
  assert.deepEqual(result.trace, ['sense', 'memory']);
  assert.equal(result.execution, 'none');
});

test('never treats repeated actions as already executed', () => {
  const input = { message: 'mover arquivo de teste', scope: 'meu laboratório', authorized: true };
  const first = orchestrate(input);
  const second = orchestrate(input);
  assert.equal(first.mode, 'planned');
  assert.equal(second.mode, 'planned');
  assert.equal(second.action.status, 'not_executed');
  assert.equal(second.verified, false);
});

test('blocks tasks without scope and authorization', () => {
  const result = orchestrate({ message: 'mover arquivo de teste' });
  assert.equal(result.mode, 'blocked');
});

test('stores answers only as explicit memory, not proof of task execution', () => {
  rememberVerifiedAnswer('Qual é o nome?', 'VERIS CIBER');
  const result = orchestrate({ message: 'Qual é o nome?' });
  assert.equal(result.answer, 'VERIS CIBER');
  assert.equal(result.execution, 'none');
});
