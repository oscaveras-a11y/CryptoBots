import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTaskJournal} from '../agents/code/task-journal.js';
test('task journal survives restart and requires verification and approval',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-journal-'));
 try{
  const file=join(dir,'tasks.json');
  const a=createTaskJournal({file});
  const task=await a.create({project:'demo',instruction:'Corrigir bug'});
  const b=createTaskJournal({file});
  assert.equal((await b.get(task.id)).phase,'investigate');
  await assert.rejects(b.finish(task.id,{status:'completed'}),/completion_evidence_required/);
  await b.advance(task.id,{phase:'reason',note:'Analisados arquivos'});
  await b.advance(task.id,{phase:'propose',note:'Proposta criada'});
  await b.advance(task.id,{phase:'verify',note:'Testes preparados'});
  await assert.rejects(b.advance(task.id,{phase:'review',note:'Sem testes'}),/test_evidence_required/);
  await b.advance(task.id,{phase:'review',note:'Testes aprovados',evidence:{testsPassed:true}});
  await b.finish(task.id,{status:'completed',evidence:{testsPassed:true,approved:true}});
  assert.equal((await a.get(task.id)).status,'completed');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('blocked tasks preserve a reason and cannot resume implicitly',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-journal-'));
 try{
  const j=createTaskJournal({file:join(dir,'tasks.json')});
  const task=await j.create({project:'demo',instruction:'Revisar'});
  await j.finish(task.id,{status:'blocked',evidence:{reason:'approval pending'}});
  await assert.rejects(j.advance(task.id,{phase:'reason',note:'continue'}),/task_not_active/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
