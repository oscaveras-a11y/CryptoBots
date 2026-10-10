import test from 'node:test';
import assert from 'node:assert/strict';
import { VerisCore } from '../src/index.js';
import { connectAgents } from '../src/connect-agents.js';

test('connects all twelve specialized modules',()=>{
 const core=connectAgents(new VerisCore());
 assert.equal(core.agents.length,12);
 assert.ok(core.agents.every(agent=>agent.connected));
});
test('known question uses safe response',async()=>{
 const core=connectAgents(new VerisCore());
 const result=await core.run({message:'O que é VERIS CIBER?'});
 assert.equal(result.status,'answered');
 assert.ok(typeof result.answer==='string');
});
test('authorization alone never enables execution',async()=>{
 const core=connectAgents(new VerisCore());
 const result=await core.run({message:'Execute algo',scope:'lab',authorized:true,data:{requestedAgent:'action'}});
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'guard_approval_required');
 assert.ok(!result.trace.some(step=>step.agent==='action'));
 assert.ok(!result.verified);
});
