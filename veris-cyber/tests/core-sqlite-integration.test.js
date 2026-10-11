import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {VerisCore} from '../core/src/index.js';

test('CORE connects CODE journal and worker to one durable SQLite store',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-core-migrate-'));
 const previous=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 const opened=[];
 try{
  const core=new VerisCore();
  const file=join(dir,'code.json');
  const journal=core.createCodeJournal({file});opened.push(journal);
  const first=await journal.create({project:'alpha',instruction:'Inspect'});
  const second=core.createCodeJournal({file});opened.push(second);
  const third=await second.create({project:'alpha',instruction:'Verify'});
  assert.equal((await journal.list()).length,2);
  assert.notEqual(first.id,third.id);
  const options={file:join(dir,'worker.json'),authorizeStep:async()=>({allowed:true}),executeStep:async()=>({ok:true}),verifyStep:async()=>({verified:true})};
  const worker=core.createWorker(options);opened.push(worker);
  await worker.register({id:'job',steps:[{id:'inspect',agent:'research',instruction:'Inspect'}]});
  assert.equal((await worker.run({id:'job'})).status,'awaiting_review');
  const reopened=core.createWorker(options);opened.push(reopened);
  assert.equal((await reopened.get('job')).status,'awaiting_review');
 }finally{
  for(const item of opened)item.close();
  if(previous===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=previous;
  await rm(dir,{recursive:true,force:true});
 }
});

test('legacy JSON journal is imported without deleting the original',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-legacy-journal-'));
 const previous=process.env.VERIS_SQLITE_MEMORY_PATH;
 process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
 try{
  const file=join(dir,'tasks.json');
  await writeFile(file,JSON.stringify([{id:'abc',project:'legacy',instruction:'Saved task',phase:'investigate',status:'active',notes:[]}]));
  const core=new VerisCore();
  const journal=core.createCodeJournal({file});
  try{assert.equal((await journal.list()).length,1);}
  finally{journal.close();}
 }finally{
  if(previous===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;
  else process.env.VERIS_SQLITE_MEMORY_PATH=previous;
  await rm(dir,{recursive:true,force:true});
 }
});
