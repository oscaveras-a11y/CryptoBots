import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';

test('CODE security workflow performs read-only investigation',async()=>{
 const result=await code({instruction:'review',data:{operation:'security_workflow',files:[{path:'app.js',content:'eval(input)'}]}});
 assert.equal(result.status,'investigation_ready');
 assert.equal(result.executed,false);
 assert.ok(result.findings.some(f=>f.code==='dynamic_code_execution'));
});

test('CODE diagnosis requires isolated tests before proposing a change',async()=>{
 const result=await code({instruction:'repair slug',data:{operation:'diagnose_and_fix',files:[]}});
 assert.equal(result.status,'requires_isolated_test_runner');
});
