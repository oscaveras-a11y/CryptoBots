import test from 'node:test';
import assert from 'node:assert/strict';
import planner, { validatePlan, planWaves } from '../agents/planner/index.js';

test('dependency waves schedule independent work together', () => {
  const steps = validatePlan([
    {id:'research',agent:'research',instruction:'Find evidence'},
    {id:'vision',agent:'vision',instruction:'Inspect image'},
    {id:'action',agent:'action',instruction:'Execute after checks',dependsOn:['research','vision']}
  ]);
  assert.deepEqual(planWaves(steps),[['research','vision'],['action']]);
});
test('invalid and cyclic dependencies are rejected', () => {
  assert.throws(() => validatePlan([{id:'a',agent:'research',instruction:'A',dependsOn:['b']},{id:'b',agent:'vision',instruction:'B',dependsOn:['a']}]),/cyclic_plan/);
  assert.throws(() => validatePlan([{agent:'research',instruction:'A',dependsOn:['missing']}]),/invalid_dependencies/);
});
test('multi-agent planning requires explicit confirmation', () => {
  const data={requestedAgent:'research',planSteps:[{agent:'research',instruction:'Research'},{agent:'vision',instruction:'Inspect'}]};
  assert.equal(planner({message:'Investigate',data}).reason,'multi_agent_confirmation_required');
  const approved=planner({message:'Investigate',data:{...data,allowMultiAgentPlan:true}});
  assert.equal(approved.requiresSelection,false);
  assert.equal(approved.steps.length,2);
});
test('cyber steps never bypass explicit scope', () => {
  const result=planner({message:'Check',data:{requestedAgent:'research',allowMultiAgentPlan:true,planSteps:[{agent:'cyber',instruction:'Check'}]}});
  assert.equal(result.reason,'explicit_pentest_scope_required');
});
