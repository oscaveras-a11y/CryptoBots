import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAutonomousWorker} from '../core/src/autonomous-worker.js';
const steps=[{id:'inspect',agent:'research',instruction:'Inspect files'},{id:'propose',agent:'code',instruction:'Prepare proposal',dependsOn:['inspect']}];
test('worker checkpoints verified steps and resumes after restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-worker-'));
 try{
  const file=join(dir,'worker.json');const calls=[];
  const options={file,authorizeStep:async()=>({allowed:true}),executeStep:async({step})=>{calls.push(step.id);return {ok:true};},verifyStep:async()=>({verified:true})};
  const worker=createAutonomousWorker(options);
  await worker.register({id:'task1',steps});
  const first=await worker.run({id:'task1',stepBudget:1});
  assert.deepEqual(Object.keys(first.results),['inspect']);
  const restarted=createAutonomousWorker(options);
  const final=await restarted.run({id:'task1'});
  assert.equal(final.status,'awaiting_review');
  assert.deepEqual(calls,['inspect','propose']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('worker refuses unapproved work and does not execute',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-worker-'));
 try{
  let count=0;const worker=createAutonomousWorker({file:join(dir,'worker.json'),authorizeStep:async()=>({allowed:false}),executeStep:async()=>{count++;},verifyStep:async()=>({verified:true})});
  await worker.register({id:'task2',steps});
  assert.equal((await worker.run({id:'task2'})).status,'authorization_required');assert.equal(count,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('worker stops when independent verification fails',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-worker-'));
 try{
  const worker=createAutonomousWorker({file:join(dir,'worker.json'),authorizeStep:async()=>({allowed:true}),executeStep:async()=>({}),verifyStep:async()=>({verified:false})});
  await worker.register({id:'task3',steps});
  const result=await worker.run({id:'task3'});
  assert.equal(result.status,'verification_required');assert.deepEqual(result.results,{});
 }finally{await rm(dir,{recursive:true,force:true});}
});
