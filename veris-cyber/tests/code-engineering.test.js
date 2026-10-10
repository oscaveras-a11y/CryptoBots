import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('CODE integrates knowledge, architecture and diagnostics',async()=>{
 const result=await code({instruction:'mobile offline',data:{operation:'engineering',
 files:[{path:'app.js',content:'export const value = 1;'}],
 diagnostics:[{source:'unit test',message:'SyntaxError'}]}});
 assert.equal(result.status,'engineering_brief_ready');
 assert.equal(result.architecture.nodes.length,1);
 assert.equal(result.diagnostics[0].category,'syntax');
 assert.equal(result.guidance[0].id,'mobile');
 assert.equal(result.executed,false);
});
test('CODE engineering does not invent test success',async()=>{
 const result=await code({instruction:'api',data:{operation:'engineering'}});
 assert.equal(result.verified,false);
 assert.ok(result.limitations.includes('no_tests_executed'));
});
