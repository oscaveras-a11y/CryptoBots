import test from 'node:test';
import assert from 'node:assert/strict';
import { advancedLessons } from '../agents/code/advanced-knowledge.js';
import code from '../agents/code/index.js';

test('twelve distinct advanced knowledge domains are available',()=>{
 assert.equal(advancedLessons.length,12);
 assert.equal(new Set(advancedLessons.map(x=>x.id)).size,12);
 for(const item of advancedLessons){
  assert.ok(item.guidance.length>100,item.id);
  assert.ok(item.checks.length>=2,item.id);
 }
});
test('engineering workflow retrieves specialized knowledge',async()=>{
 for(const [topic,id] of [['distributed retry','distributed'],['observability tracing','observability'],['frontend accessibility','frontend'],['mobile offline','mobile'],['api http','api'],['concurrency race','concurrency'],['deployment release','deployment'],['docker container','containers'],['algorithm complexity','algorithms'],['git github','git'],['privacy encryption','privacy'],['llm rag','ai']]){
  const r=await code({data:{operation:'engineering',topic,limit:3}});
  assert.equal(r.guidance[0].id,id,topic);
  assert.equal(r.executed,false);
 }
});
