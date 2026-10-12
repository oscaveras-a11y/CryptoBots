import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TaskQueue} from '../core/src/task-queue.js';

test('CORE queue persists completed work across restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jarvis-queue-'));
 const previous=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 try{
  const q=new TaskQueue({durable:true,namespace:'queue-test-complete'});
  const {id}=q.submit(async()=>({verified:true}));
  for(let i=0;i<100&&q.get(id)?.status!=='completed';i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(q.get(id).status,'completed');q.close();
  const restored=new TaskQueue({durable:true,namespace:'queue-test-complete'});
  assert.deepEqual(restored.get(id).result,{verified:true});
  restored.close();
 }finally{
  if(previous===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=previous;
  await rm(dir,{recursive:true,force:true});
 }
});

test('CORE never replays interrupted side effects automatically',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jarvis-interrupted-'));
 const previous=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 try{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const q=new TaskQueue({durable:true,namespace:'queue-test-interrupted'});
  const {id}=q.submit(()=>gate);
  await new Promise(r=>setTimeout(r,10));
  const restored=new TaskQueue({durable:true,namespace:'queue-test-interrupted'});
  assert.equal(restored.get(id).status,'interrupted');
  assert.equal(restored.get(id).error,'restart_requires_explicit_resubmission');
  restored.close();release('done');
  for(let i=0;i<100&&q.get(id)?.status!=='completed';i++)await new Promise(r=>setTimeout(r,5));
  q.close();
 }finally{
  if(previous===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=previous;
  await rm(dir,{recursive:true,force:true});
 }
});
