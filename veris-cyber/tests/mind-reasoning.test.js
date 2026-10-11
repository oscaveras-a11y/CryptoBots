import test from 'node:test';
import assert from 'node:assert/strict';
import mind from '../agents/mind/index.js';
import {reasonAboutGoal} from '../agents/mind/reasoning-engine.js';
test('reasoning separates verified evidence from hypotheses',()=>{
 const r=reasonAboutGoal({goal:'Analisar segurança',evidence:[{claim:'Firewall active',source:'local-check',verified:true},{claim:'RDP vulnerable',verified:false}]});
 assert.equal(r.status,'reasoned');
 assert.equal(r.facts.length,1);
 assert.equal(r.hypotheses.length,1);
 assert.equal(r.executed,false);
});
test('reasoning requests explicit approval for modifications',()=>{
 const r=reasonAboutGoal({goal:'Verificar portas e depois mover arquivo'});
 assert.equal(r.tasks.length,2);
 assert.equal(r.requiresApproval,true);
 assert.equal(r.nextAction,'request_explicit_action_approval');
});
test('MIND dispatches structured reasoning',async()=>{
 const r=await mind({message:'Diagnosticar o computador',intent:'reason',data:{}});
 assert.equal(r.status,'reasoned');
 assert.equal(r.tasks[0].category,'investigation');
});
test('reasoning rejects invalid goals',()=>assert.equal(reasonAboutGoal({goal:''}).status,'invalid_goal'));
