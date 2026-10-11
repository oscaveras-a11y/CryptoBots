import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('cycle requires runner without execution permission',async()=>{
 const r=await code({data:{operation:'cycle'}});
 assert.equal(r.status,'requires_isolated_test_runner');
});
test('cycle retries failing checks and requires review',async()=>{
 let calls=0;
 const r=await code({instruction:'fix node',data:{operation:'cycle',files:[]}},{
  generateChanges:async()=>({changes:[{path:'new.js',content:'export const ok = true;',expectedSha256:null}]}),
  runChecks:async()=>{
   calls++;
   return {testResults:[{status:calls===1?'failed':'passed',source:'isolated',name:'unit'}],staticAnalysis:[{status:'passed',source:'isolated',name:'lint'}],runnerResult:{status:calls===1?'failed':'passed',executed:true}};
  }
 });
 assert.equal(calls,2);
 assert.equal(r.status,'review_required');
 assert.equal(r.verified,false);
 assert.equal(r.requiresApproval,true);
});
test('cycle limits retries',async()=>{
 await assert.rejects(()=>code({data:{operation:'cycle',maxAttempts:4}}),/invalid_attempt_limit/);
});
