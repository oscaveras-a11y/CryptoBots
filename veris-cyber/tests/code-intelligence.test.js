import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
test('architecture inventory',async()=>{
 const r=await code({data:{operation:'architecture',files:[{path:'app.js',content:'export const a = 1;'}]}});
 assert.equal(r.status,'architecture_mapped');
 assert.equal(r.nodes.length,1);
});
test('solution ranking',async()=>{
 const r=await code({data:{operation:'reason',options:[{name:'simple',goal:'correctness',risk:1,complexity:1,testability:5}]}});
 assert.equal(r.ranking[0].name,'simple');
});
test('diagnostic triage',async()=>{
 const r=await code({data:{operation:'debug',diagnostics:[{source:'test',message:'SyntaxError'}]}});
 assert.equal(r.failures[0].category,'syntax');
});
test('refactoring plan',async()=>{
 const r=await code({data:{operation:'refactor_plan',changes:[{path:'app.js',objective:'Extract function'}]}});
 assert.equal(r.steps[0].requiresReview,true);
 assert.equal(r.executed,false);
});
