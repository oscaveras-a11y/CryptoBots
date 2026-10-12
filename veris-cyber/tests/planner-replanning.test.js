import test from 'node:test';
import assert from 'node:assert/strict';
import { VerisCore } from '../core/src/index.js';

function makeCore({alternative=true}={}) {
  let calls=0, plans=0;
  const core = new VerisCore({handlers:{
    sense:async()=>({intent:'task'}),
    memory:async()=>({verified:false}),
    guard:async()=>({allowed:true,allowExecution:true}),
    planner:async({data})=>{
      plans++;
      if(data.planningMode==='recovery')return {steps:alternative
        ?[{id:'alternative',agent:'vision',instruction:'Inspect other evidence'}]
        :[{id:'initial',agent:'research',instruction:'Research'}]};
      return {steps:[{id:'initial',agent:'research',instruction:'Research'}]};
    },
    research:async()=>{calls++;throw Error('source_unavailable');}
  }});
  return {core,counts:()=>({calls,plans})};
}
test('failed read-only step proposes a distinct plan but never executes it',async()=>{
  const {core,counts}=makeCore();
  const task=await core.run({message:'Investigate',scope:'project',authorized:true,data:{requestedAgent:'research'}});
  assert.equal(task.status,'replan_proposed');
  assert.equal(task.replan.automaticExecution,false);
  assert.equal(task.replan.steps[0].agent,'vision');
  assert.equal(counts().calls,2);
  assert.equal(counts().plans,2);
});
test('unchanged fallback is rejected and failure remains visible',async()=>{
  const {core,counts}=makeCore({alternative:false});
  const task=await core.run({message:'Investigate',scope:'project',authorized:true,data:{requestedAgent:'research'}});
  assert.equal(task.status,'incomplete');
  assert.equal(task.replan,undefined);
  assert.equal(counts().calls,2);
});
