import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAutonomousWorker} from '../core/src/autonomous-worker.js';
import {VerisCore,AGENT_NAMES} from '../core/src/index.js';

test('CORE exposes all twelve agents and retains history in SQLite',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jarvis-core-history-'));
 const prior=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 try{
  const core=new VerisCore({durableQueue:true});
  assert.equal(core.agents.length,12);
  assert.deepEqual(core.agents.map(x=>x.name),AGENT_NAMES);
  const task=await core.run({message:'Olá',mode:'informational'});
  core.close();
  const reopened=new VerisCore({durableQueue:true});
  assert.equal(reopened.getTask(task.id)?.status,task.status);
  reopened.close();
 }finally{
  if(prior===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=prior;
  await rm(dir,{recursive:true,force:true});
 }
});

test('SQLite worker lease prevents simultaneous execution from independent processes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jarvis-worker-lease-'));
 const prior=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 let release;const gate=new Promise(r=>{release=r;});
 const file=join(dir,'tasks.json');
 const options={file,authorizeStep:async()=>({allowed:true}),verifyStep:async()=>({verified:true}),executeStep:async()=>gate};
 const first=createAutonomousWorker(options),second=createAutonomousWorker(options);
 try{
  await first.register({id:'job',steps:[{id:'a',agent:'research',instruction:'Search'}]});
  const running=first.run({id:'job'});
  for(let i=0;i<100;i++){
   const state=await second.get('job');
   if(state?.inFlight)break;
   await new Promise(r=>setTimeout(r,5));
  }
  await assert.rejects(second.run({id:'job'}),/task_already_running/);
  release({ok:true});
  assert.equal((await running).status,'awaiting_review');
 }finally{
  release({ok:true});first.close();second.close();
  if(prior===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=prior;
  await rm(dir,{recursive:true,force:true});
 }
});
