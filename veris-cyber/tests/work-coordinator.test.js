import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkCoordinator} from '../core/src/work-coordinator.js';
const steps=[{id:'inspect',agent:'research',instruction:'Read sources'},{id:'fix',agent:'code',instruction:'Prepare correction',dependsOn:['inspect']}];
const journal={get:async()=>({id:'task',status:'active'}),advance:async()=>{}};
test('coordinator does not execute unauthorized steps',async()=>{
 let calls=0;
 const runner=createWorkCoordinator({journal,executeStep:async()=>{calls++;},authorizeStep:async()=>({allowed:false,reason:'approval_missing'}),verifyStep:async()=>({verified:true})});
 const result=await runner.runNext({taskId:'task',steps});
 assert.equal(result.status,'authorization_required');assert.equal(calls,0);
});
test('coordinator executes one step and requires independent verification',async()=>{
 const runner=createWorkCoordinator({journal,executeStep:async()=>({files:2}),authorizeStep:async()=>({allowed:true}),verifyStep:async()=>({verified:true})});
 const result=await runner.runNext({taskId:'task',steps});
 assert.equal(result.status,'step_completed');assert.equal(result.stepId,'inspect');
 const resumed=await runner.runNext({taskId:'task',steps,results:{inspect:{status:'completed',verified:true}}});
 assert.equal(resumed.stepId,'fix');
});
test('coordinator reports failed verification and retry classification',async()=>{
 const runner=createWorkCoordinator({journal,executeStep:async()=>({}),authorizeStep:async()=>({allowed:true}),verifyStep:async()=>({verified:false})});
 assert.equal((await runner.runNext({taskId:'task',steps})).status,'verification_required');
 const broken=createWorkCoordinator({journal,executeStep:async()=>{throw new Error('network_timeout');},authorizeStep:async()=>({allowed:true}),verifyStep:async()=>({verified:true})});
 assert.equal((await broken.runNext({taskId:'task',steps})).status,'retryable');
});
