import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('CODE retrieves targeted programming guidance',async()=>{
 const r=await code({instruction:'Help with SQL migration',data:{operation:'knowledge',topic:'sql migration',limit:2}});
 assert.equal(r.status,'knowledge_ready');
 assert.equal(r.lessons.length,2);
 assert.equal(r.lessons[0].id,'database');
 assert.equal(r.limitations.includes('curated_guidance_not_model_training'),true);
});
test('CODE knowledge rejects unbounded requests',async()=>{
 await assert.rejects(()=>code({data:{operation:'knowledge',topic:'test',limit:100}}),/invalid_knowledge_query/);
});
test('CODE knowledge contains development verification workflow',async()=>{
 const r=await code({data:{operation:'knowledge',topic:'debug'}});
 assert.ok(r.workflow.includes('test'));
 assert.ok(r.lessons.some(x=>x.id==='debugging'));
});
