import test from 'node:test';
import assert from 'node:assert/strict';
import {nextPlanSteps} from '../agents/planner/index.js';
import {reviewTaskEvidence} from '../agents/verify/index.js';
import {rankResearchEvidence} from '../agents/research/index.js';
const steps=[{id:'read',agent:'research',instruction:'Inspect sources'},{id:'fix',agent:'code',instruction:'Prepare fix',dependsOn:['read']}];
test('PLANNER resumes only after verified dependency',()=>{
 assert.deepEqual(nextPlanSteps(steps).ready.map(s=>s.id),['read']);
 assert.deepEqual(nextPlanSteps(steps,{read:{status:'completed',verified:false}}).ready.map(s=>s.id),['read']);
 assert.deepEqual(nextPlanSteps(steps,{read:{status:'completed',verified:true}}).ready.map(s=>s.id),['fix']);
 assert.equal(nextPlanSteps(steps,{read:{status:'blocked'}}).status,'blocked');
});
test('VERIFY rejects absent tests and identifies failures',()=>{
 assert.equal(reviewTaskEvidence().status,'insufficient_test_evidence');
 assert.deepEqual(reviewTaskEvidence({checks:[{name:'unit',status:'failed'}]}).failures,['unit']);
 assert.equal(reviewTaskEvidence({checks:[{name:'unit',status:'passed'}]}).status,'approval_required');
});
test('RESEARCH ranks supplied evidence without asserting truth',()=>{
 const sources=[{title:'Other',excerpt:'Unrelated content',url:'https://example.org/one'},{title:'SQLite transaction',excerpt:'Fix SQLite transaction issue',url:'https://example.com/two'}];
 const ranked=rankResearchEvidence('SQLite transaction',sources);
 assert.equal(ranked[0].title,'SQLite transaction');
 assert.equal(ranked[0].valid,true);
});
