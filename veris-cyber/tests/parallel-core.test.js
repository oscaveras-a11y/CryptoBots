import test from 'node:test';
import assert from 'node:assert/strict';
import { VerisCore } from '../core/src/index.js';

test('informational planning starts MIND and PLANNER independently', async () => {
  const started = new Set();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const wait = name => async () => {
    started.add(name);
    await gate;
    return name === 'mind' ? { answer: 'Plano em preparação' } : { steps: [{ agent: 'research', instruction: 'Pesquisar' }], requiresSelection: false };
  };
  const core = new VerisCore({ handlers: {
    sense: async () => ({ intent: 'task' }),
    memory: async () => ({ verified: false }),
    mind: wait('mind'),
    planner: wait('planner')
  } });
  const pending = core.run({ message: 'Pesquisar tema', mode: 'informational', data: { requestedAgent: 'research' } });
  try {
    for (let i = 0; i < 50 && started.size < 2; i++) await new Promise(resolve => setTimeout(resolve, 2));
    assert.deepEqual([...started].sort(), ['mind', 'planner']);
  } finally { release(); }
  const result = await pending;
  assert.equal(result.status, 'planned');
  assert.ok(result.trace.some(item => item.agent === 'mind' && Number.isFinite(item.durationMs)));
  assert.ok(result.trace.some(item => item.agent === 'planner' && Number.isFinite(item.durationMs)));
  assert.equal(result.executed, false);
});
