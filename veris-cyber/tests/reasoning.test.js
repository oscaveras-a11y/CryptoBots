import test from 'node:test';
import assert from 'node:assert/strict';
import { planTask, reason } from '../src/reasoning.js';

test('plans a request without claiming execution', () => {
  const plan = planTask('auditar meu projeto');
  assert.equal(plan.execution, 'not_started');
  assert.equal(plan.steps.length, 4);
});

test('requires valid user message', async () => {
  await assert.rejects(() => reason({ message: '' }, { apiKey: 'test' }), TypeError);
});

test('reports missing provider configuration', async () => {
  const response = await reason({ message: 'olá' }, { apiKey: '' });
  assert.equal(response.status, 'needs_configuration');
});

test('queries configured model without tool execution', async () => {
  let request;
  const fetchImpl = async (_url, init) => {
    request = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Verifique as evidências.' } }] }) };
  };
  const response = await reason({ message: 'analise o risco' }, { apiKey: 'test', fetchImpl });
  assert.equal(response.status, 'ok');
  assert.equal(response.execution, 'text_only');
  assert.equal(request.tools, undefined);
});
