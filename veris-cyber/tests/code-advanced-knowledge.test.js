import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('CODE can retrieve new mobile knowledge',async()=>{
 const r=await code({data:{operation:'knowledge',topic:'mobile offline',limit:3}});
 assert.equal(r.status,'knowledge_ready');
 assert.equal(r.lessons[0].id,'mobile');
});
test('CODE can retrieve distributed systems knowledge',async()=>{
 const r=await code({data:{operation:'knowledge',topic:'distributed retry',limit:2}});
 assert.equal(r.lessons[0].id,'distributed');
});
test('CODE can retrieve AI integration knowledge',async()=>{
 const r=await code({data:{operation:'knowledge',topic:'llm rag',limit:2}});
 assert.equal(r.lessons[0].id,'ai');
});
