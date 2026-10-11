import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';

test('security investigation includes remediation and remains read-only',async()=>{
 const result=await code({data:{operation:'security_workflow',files:[{path:'service.js',content:'eval(payload);\nconst id = Math.random();'}]}});
 assert.equal(result.status,'investigation_ready');
 assert.equal(result.executed,false);
 assert.ok(result.findings.some(f=>f.code==='dynamic_code_execution'&&f.remediation));
 assert.ok(result.findings.some(f=>f.code==='weak_randomness_review'));
});
