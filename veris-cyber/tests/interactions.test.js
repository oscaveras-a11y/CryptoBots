import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInteractionMemory} from '../agents/memory/interactions.js';
import {VerisCore} from '../core/src/index.js';

test('session interactions persist and remain isolated',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jarvis-sessions-'));
 const old=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 try{
  const first=createInteractionMemory();
  first.append({scope:'a',sessionId:'one',role:'user',content:'Olá'});
  first.close();
  const second=createInteractionMemory();
  assert.equal(second.list('a','one')[0].content,'Olá');
  assert.deepEqual(second.list('b','one'),[]);
  assert.deepEqual(second.list('a','two'),[]);
  assert.equal(second.clear('a','one').removed,1);
  assert.deepEqual(second.list('a','one'),[]);
  assert.throws(()=>second.append({scope:'a',sessionId:'one',role:'system',content:'x'}),/invalid_interaction/);
  second.close();
 }finally{
  if(old===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=old;
  await rm(dir,{recursive:true,force:true});
 }
});

test('CORE records and retrieves conversation context',async()=>{
 const core=new VerisCore();
 const first=await core.run({message:'Olá',mode:'informational',data:{sessionId:'interaction-test'}});
 const second=await core.run({message:'Pode continuar?',mode:'informational',data:{sessionId:'interaction-test'}});
 assert.ok(second.interactionContext.some(x=>x.content==='Olá'));
 assert.ok(core.recallInteractions({sessionId:'interaction-test'}).some(x=>x.role==='assistant'&&x.content===first.answer));
 core.clearInteractions({sessionId:'interaction-test'});
 core.close();
});
