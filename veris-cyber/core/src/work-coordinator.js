// Persisted task runner: one authorized step per invocation, resumable after interruption.
// Host supplies a trusted executor. This module cannot execute commands or grant permissions.
import {nextPlanSteps} from '../../agents/planner/index.js';
import {classifyTaskFailure} from './engine-readiness.js';
const maxSteps=12;
const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function createWorkCoordinator({journal,executeStep,authorizeStep,verifyStep}={}){
 if(!journal||typeof journal.get!=='function'||typeof journal.advance!=='function'||typeof executeStep!=='function'||typeof authorizeStep!=='function'||typeof verifyStep!=='function')throw new TypeError('invalid_coordinator_dependencies');
 return {
  async runNext({taskId,steps,results={}}={}){
   if(!isObject(results))throw new TypeError('invalid_step_results');
   const task=await journal.get(taskId);
   if(!task)throw new Error('task_not_found');
   if(task.status!=='active')return {status:task.status,taskId};
   const plan=nextPlanSteps(steps,results,1);
   if(plan.status==='completed')return {status:'awaiting_final_review',taskId};
   if(!plan.ready.length)return {status:plan.status,taskId,blocked:plan.blocked};
   const step=plan.ready[0];
   const authorization=await authorizeStep({task,step});
   if(authorization?.allowed!==true)return {status:'authorization_required',taskId,stepId:step.id,reason:authorization?.reason??'not_authorized'};
   try{
    const output=await executeStep({task,step});
    const verification=await verifyStep({task,step,output});
    if(verification?.verified!==true)return {status:'verification_required',taskId,stepId:step.id,output,reason:verification?.reason??'insufficient_evidence'};
    return {status:'step_completed',taskId,stepId:step.id,result:{status:'completed',verified:true},output};
   }catch(error){
    const failure=classifyTaskFailure(error);
    return {status:failure.category,taskId,stepId:step.id,failure};
   }
  }
 };
}
