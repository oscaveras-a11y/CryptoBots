import test from 'node:test';
import assert from 'node:assert/strict';
import { VerisCore, AGENT_NAMES } from '../src/index.js';

test('registers all 12 slots', () => {
  const core = new VerisCore();
  assert.equal(core.agents.length, 12);
  assert.deepEqual(core.agents.map(a => a.name), AGENT_NAMES);
});
test('answers known question without executing actions', async () => {
  const core = new VerisCore();
  const task = await core.run({ message: 'O que é VERIS CIBER?' });
  assert.equal(task.status, 'answered');
  assert.equal(task.trace.some(t => t.agent === 'action'), false);
});
test('blocks task without authorization', async () => {
  const core = new VerisCore();
  const task = await core.run({ message: 'Analise meus arquivos' });
  assert.equal(task.status, 'blocked');
});
test('does not execute when guard is absent', async () => {
  let executed = false;
  const core = new VerisCore({ handlers: { action: () => { executed = true; } } });
  const task = await core.run({ message: 'Execute uma tarefa', authorized: true, scope: 'lab' });
  assert.equal(task.status, 'blocked');
  assert.equal(executed, false);
});
test('routes through guard planner action verify', async () => {
  const core = new VerisCore({ handlers: {
    guard: () => ({ allowed: true, allowExecution: true }),
    planner: () => ({ steps: [{ agent: 'action', instruction: 'run approved mock' }] }),
    action: () => ({ done: true, executed: true, verified: true }),
    verify: ({ steps }) => ({ verified: steps.length === 1 && steps[0].status === 'ok' })
  } });
  const task = await core.run({ message: 'Execute tarefa simulada', authorized: true, scope: 'lab' });
  assert.equal(task.status, 'completed');
  assert.equal(task.verified, true);
  assert.equal(core.getTask(task.id).id, task.id);
});
test('does not claim success without verifier', async () => {
  const core = new VerisCore({ handlers: {
    guard: () => ({ allowed: true, allowExecution: true }),
    planner: () => ({ steps: [{ agent: 'action', instruction: 'simulate' }] }),
    action: () => ({ done: true })
  } });
  const task = await core.run({ message: 'Execute tarefa simulada', authorized: true, scope: 'lab' });
  assert.equal(task.status, 'unverified');
});

test('main engine returns a useful informational plan through MIND and PLANNER',async()=>{
  const core=new VerisCore();
  const task=await core.run({message:'Corrija o codigo do meu programa',mode:'informational'});
  assert.equal(task.status,'planned');
  assert.equal(task.plan.steps[0].agent,'code');
  assert.equal(task.plan.steps[0].instruction,'Corrija o codigo do meu programa');
  assert.ok(task.plan.suggestedChecks.length>0);
  assert.ok(task.trace.some(x=>x.agent==='mind'));
  assert.ok(task.trace.some(x=>x.agent==='planner'));
  assert.equal(task.executed,false);
  assert.equal(task.verified,false);
  assert.match(task.answer,/code/i);
});

