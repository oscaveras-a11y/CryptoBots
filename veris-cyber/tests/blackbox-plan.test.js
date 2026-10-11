import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';

test('black box requires explicit scope and trusted authorization',async()=>{
 const targets=['example.com'];
 const denied=await code({data:{operation:'blackbox_plan',targets}});
 assert.equal(denied.status,'authorization_required');
 const plan=await code({data:{operation:'blackbox_plan',targets,authorization:{confirmed:true,reference:'engagement-001',targets}}});
 assert.equal(plan.status,'plan_ready');
 assert.equal(plan.executed,false);
 assert.equal(plan.requiresTrustedAuthorization,true);
 assert.deepEqual(plan.targets,targets);
});
test('black box rejects unsupported checks and invalid targets',async()=>{
 await assert.rejects(()=>code({data:{operation:'blackbox_plan',targets:['127.0.0.1'],authorization:{confirmed:true,reference:'test',targets:['127.0.0.1']}}}),/invalid_target/);
 await assert.rejects(()=>code({data:{operation:'blackbox_plan',targets:['example.com'],authorization:{confirmed:true,reference:'test',targets:['example.com']},checks:['exploit']}}),/unsupported_check/);
});
