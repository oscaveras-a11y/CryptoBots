import test from 'node:test';
import assert from 'node:assert/strict';
import { VerisCore } from '../core/src/index.js';

test('read-only failed research is retried once, preserving dependent results', async () => {
  let attempts = 0;
  const core = new VerisCore({ handlers: {
    sense: async () => ({ intent: 'task' }),
    memory: async () => ({ verified: false }),
    guard: async () => ({ allowed: true, allowExecution: true }),
    planner: async () => ({ steps: [
      {id:'r',agent:'research',instruction:'Research'},
      {id:'v',agent:'vision',instruction:'Inspect',dependsOn:['r']}
    ] }),
    research: async () => { if (++attempts === 1) throw Error('transient_failure'); return { verified: true, executed: true, value: 42 }; },
    vision: async ({data}) => ({ verified: true, executed: true, observed: data.dependencies.r.value }),
    verify: async ({steps}) => ({verified: steps.every(s=>s.result?.verified === true)})
  } });
  const result = await core.run({message:'Investigate',scope:'project',authorized:true,data:{requestedAgent:'research'}});
  assert.equal(attempts,2);
  assert.equal(result.steps[0].attempts,2);
  assert.equal(result.steps[1].result.observed,42);
  assert.equal(result.recovery[0].recovered,true);
});
test('side-effecting action is never retried automatically', async () => {
  let attempts = 0;
  const core = new VerisCore({ handlers: {
    sense: async () => ({ intent: 'task' }),
    memory: async () => ({ verified: false }),
    guard: async () => ({ allowed: true, allowExecution: true }),
    planner: async () => ({ steps: [{agent:'action',instruction:'Act'}] }),
    action: async () => { attempts++; throw Error('failure'); }
  } });
  const result = await core.run({message:'Act',scope:'project',authorized:true,data:{requestedAgent:'action'}});
  assert.equal(attempts,1);
  assert.equal(result.status,'incomplete');
});
