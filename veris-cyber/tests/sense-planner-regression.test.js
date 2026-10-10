import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSense} from '../agents/sense/index.js';
import planner from '../agents/planner/index.js';

test('SENSE recognizes continuation and improvement as tasks',()=>{
 for(const message of ['Continue fazendo melhoria','Melhore o código','Otimize o projeto','Prossiga com os testes']){
  const result=analyzeSense({message});
  assert.equal(result.intent,'task',message);
 }
});
test('SENSE does not execute informational questions or negated commands',()=>{
 assert.equal(analyzeSense({message:'Como executar o programa?'}).intent,'question');
 assert.equal(analyzeSense({message:'Não quero executar nada'}).intent,'conversation');
});
test('PLANNER validates inputs and keeps security operations gated',()=>{
 assert.throws(()=>planner({message:'test',data:[]}),/invalid_plan_data/);
 assert.throws(()=>planner({message:'a'.repeat(4001),data:{requestedAgent:'code'}}),/invalid_plan_request/);
 const denied=planner({message:'Audite a segurança',data:{requestedAgent:'cyber'}});
 assert.equal(denied.requiresSelection,true);
 assert.equal(denied.steps.length,0);
 const allowed=planner({message:'Audite o ambiente autorizado',data:{requestedAgent:'cyber',authorization:{confirmed:true},target:'lab',activity:'audit'}});
 assert.equal(allowed.steps[0].agent,'cyber');
 assert.equal(allowed.requiresSelection,false);
});
