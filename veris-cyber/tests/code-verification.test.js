import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
const proposal={status:'proposal_ready',proposalId:'abc',changes:[{path:'src/a.js'}]};
const passed={name:'unit suite',status:'passed',source:'isolated runner'};
const lint={name:'static analysis',status:'passed',source:'isolated runner'};
test('CODE verification requires passing tests, analysis and matching approval',async()=>{
 const result=await code({data:{operation:'verify',proposal,testResults:[passed],staticAnalysis:[lint],approval:{confirmed:true,proposalId:'abc'}}});
 assert.equal(result.status,'review_passed');
 assert.equal(result.verified,true);
 assert.equal(result.executed,false);
});
test('CODE verification rejects failures and missing approval',async()=>{
 const result=await code({data:{operation:'verify',proposal,testResults:[{...passed,status:'failed'}],staticAnalysis:[lint]}});
 assert.equal(result.verified,false);
 assert.equal(result.checks.failed,1);
 assert.ok(result.missing.includes('matching_approval'));
});
test('CODE verification cannot pass without real evidence',async()=>{
 const result=await code({data:{operation:'verify',proposal,approval:{confirmed:true,proposalId:'abc'}}});
 assert.equal(result.verified,false);
 assert.ok(result.missing.includes('passing_tests'));
});
