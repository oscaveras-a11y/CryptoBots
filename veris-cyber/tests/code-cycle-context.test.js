import test from 'node:test';
import assert from 'node:assert/strict';
import {runDevelopmentCycle} from '../agents/code/cycle.js';
test('CODE cycle supplies ranked project context to generator',async()=>{
 let received;
 const result=await runDevelopmentCycle({instruction:'fix authenticateUser',files:[{path:'src/auth.js',content:'export function authenticateUser() {}'}]},{
  generateChanges:async input=>{received=input.context;return {changes:[{path:'new.js',content:'export const ok = true;',expectedSha256:null}]};},
  prepareChanges:()=>({status:'proposal_ready',proposalId:'test',changes:[]}),
  runChecks:async()=>({testResults:[{status:'passed'}],staticAnalysis:[{status:'passed'}],runnerResult:{status:'passed',executed:true}})
 });
 assert.equal(received.selected[0].path,'src/auth.js');
 assert.equal(result.status,'review_required');
});
test('CODE cycle refuses to pass without real runner evidence',async()=>{
 const result=await runDevelopmentCycle({instruction:'fix code',maxAttempts:1},{
  generateChanges:async()=>({changes:[{path:'new.js',content:'ok',expectedSha256:null}]}),
  prepareChanges:()=>({status:'proposal_ready',proposalId:'test',changes:[]}),
  runChecks:async()=>({testResults:[{status:'passed'}],staticAnalysis:[{status:'passed'}]})
 });
 assert.equal(result.status,'checks_failed');
});
