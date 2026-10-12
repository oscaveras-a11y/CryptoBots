import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('cycle without execution permission requires runner',async()=>{
 const r=await code({data:{operation:'cycle',files:[]}},{
  generateChanges:async()=>({changes:[{path:'a.test.js',content:'',expectedSha256:null}]})
 });
 assert.equal(r.status,'requires_isolated_test_runner');
});
test('cycle rejects invalid generated baseline',async()=>{
 const result=await code({data:{operation:'cycle',files:[]}},{
  generateChanges:async()=>({changes:[{path:'a.test.js',content:'',expectedSha256:'wrong'}]}),
  runChecks:async()=>({testResults:[],staticAnalysis:[]})
 });
 assert.equal(result.status,'checks_failed');
 assert.equal(result.attempts,2);
 assert.equal(result.history.length,2);
 assert.ok(result.history.every(x=>x.error==='new_file_requires_null_baseline'));
 assert.equal(result.verified,false);
});
