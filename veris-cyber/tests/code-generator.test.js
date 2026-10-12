import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('built-in generator creates code and regression test',async()=>{
 const r=await code({instruction:'criar função de soma',data:{operation:'generate',files:[]}});
 assert.equal(r.status,'generated');
 assert.equal(r.changes.length,2);
 assert.equal(r.changes[0].expectedSha256,null);
 assert.match(r.changes[1].content,/node:test/);
});
test('generator refuses unsupported tasks without inventing changes',async()=>{
 const r=await code({instruction:'build a complete operating system',data:{operation:'generate'}});
 assert.equal(r.status,'unsupported_generation_task');
 assert.deepEqual(r.changes,[]);
});
test('cycle uses built-in generator and awaits checks',async()=>{
 const r=await code({instruction:'somar números',data:{operation:'cycle',files:[]}},{
  runChecks:async()=>({testResults:[{name:'unit',source:'test',status:'passed'}],staticAnalysis:[{name:'lint',source:'test',status:'passed'}]})
 });
 assert.equal(r.status,'review_required');
 assert.equal(r.proposal.changes.length,2);
});
