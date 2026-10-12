import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('develop produces baseline-validated proposal',async()=>{
 const r=await code({instruction:'mobile offline',data:{operation:'develop',files:[]}},{
  generateChanges:async()=>({changes:[{path:'new.js',content:'export const ready = true;',expectedSha256:null}]})
 });
 assert.equal(r.status,'proposal_requires_tests');
 assert.equal(r.proposal.status,'proposal_ready');
 assert.equal(r.requiresApproval,true);
});
test('develop receives external check evidence',async()=>{
 const r=await code({instruction:'api',data:{operation:'develop',files:[]}},{
  generateChanges:async()=>({changes:[{path:'new.js',content:'export const ready = true;',expectedSha256:null}]}),
  runChecks:async()=>({testResults:[{name:'unit',source:'runner',status:'passed'}]})
 });
 assert.equal(r.status,'proposal_checks_reported');
 assert.equal(r.verified,false);
});
