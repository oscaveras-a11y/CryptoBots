import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('CODE develop requires generator',async()=>{
 const r=await code({data:{operation:'develop'}});
 assert.equal(r.status,'requires_code_generator');
});
