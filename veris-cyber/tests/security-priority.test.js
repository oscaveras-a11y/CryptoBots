import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';

test('security workflow prioritizes findings and reports confidence limits',async()=>{
 const result=await code({data:{operation:'security_workflow',files:[{path:'sample.js',content:'eval(input);\n// TODO fix'}]}});
 assert.equal(result.status,'investigation_ready');
 assert.equal(result.executed,false);
 assert.ok(result.summary.high>=1);
 assert.equal(result.findings[0].severity,'high');
 assert.ok(result.limitations.includes('heuristics_not_proof_of_vulnerability'));
});
