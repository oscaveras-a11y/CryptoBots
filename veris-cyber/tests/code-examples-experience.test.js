import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('CODE examples return practical material',async()=>{
 const r=await code({data:{operation:'examples',topic:'javascript'}});
 assert.equal(r.status,'examples_ready');
 assert.ok(r.examples.length>0);
});
test('CODE experience summarizes but does not persist',async()=>{
 const r=await code({data:{operation:'experience',records:[{topic:'test',outcome:'fixed',lesson:'Add regression'}]}});
 assert.equal(r.records[0].lesson,'Add regression');
 assert.equal(r.persisted,false);
});
