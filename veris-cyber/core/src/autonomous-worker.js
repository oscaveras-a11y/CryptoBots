// Durable autonomous work loop: no bypass of host authorization or verification.
// Each step result is checkpointed; a restart resumes from verified results.
import {createHash} from 'node:crypto';
import {createStateStore} from '../../agents/memory/state-store.js';
import {validatePlan,nextPlanSteps} from '../../agents/planner/index.js';
import {classifyTaskFailure} from './engine-readiness.js';
const clone=value=>structuredClone(value);
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
export function createAutonomousWorker({file,authorizeStep,executeStep,verifyStep,maxAttempts=3}={}){
 if(typeof file!=='string'||!file.trim()||![authorizeStep,executeStep,verifyStep].every(x=>typeof x==='function')||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)throw new TypeError('invalid_worker_configuration');
 const store=createStateStore({namespace:'worker-'+createHash('sha256').update(file).digest('hex').slice(0,40),file});
 let queue=Promise.resolve();
 async function read(){const value=store.read({version:1,tasks:{}});if(value?.version!==1||!value.tasks||typeof value.tasks!=='object')throw new Error('invalid_worker_state');return value;}
 function serialized(fn){const next=queue.then(fn);queue=next.then(()=>{},()=>{});return next;}
 async function mutate(fn){return serialized(async()=>{
  const state=await read(),result=await fn(state);
  store.write(state);return clone(result);
 });}
 async function get(id){if(!validId(id))throw new TypeError('invalid_task_id');return clone((await serialized(read)).tasks[id]??null);}
 async function register({id,steps}={}){
  if(!validId(id))throw new TypeError('invalid_task_id');
  const plan=validatePlan(steps);
  return mutate(state=>{if(state.tasks[id])throw new Error('task_already_exists');const task={id,steps:plan,results:{},attempts:{},status:'active',history:[]};state.tasks[id]=task;return task;});
 }
 async function record(id,update){return mutate(state=>{const task=state.tasks[id];if(!task)throw new Error('task_not_found');update(task);task.history=task.history.slice(-100);return task;});}
 async function run({id,stepBudget=12,signal}={}){
  if(!validId(id)||!Number.isInteger(stepBudget)||stepBudget<1||stepBudget>100)throw new TypeError('invalid_run_options');
  // Only one runner per instance; checkpoint after each completed step.
  return serialized(async()=>{
   let task=(await read()).tasks[id];if(!task)throw new Error('task_not_found');
   if(task.status!=='active')return clone(task);
   // Work is performed outside mutate's queue; this serialized lock prevents concurrent runs on this instance.
   for(let count=0;count<stepBudget;count++){
    if(signal?.aborted)return clone({...task,status:'interrupted'});
    const plan=nextPlanSteps(task.steps,task.results,1);
    if(plan.status==='completed'){task.status='awaiting_review';break;}
    if(!plan.ready.length){task.status=plan.status;break;}
    const step=plan.ready[0];
    const permission=await authorizeStep({task:clone(task),step});
    if(permission?.allowed!==true){task.status='authorization_required';task.pendingStep=step.id;break;}
    const attempts=(task.attempts[step.id]??0)+1;task.attempts[step.id]=attempts;
    try{
     const output=await executeStep({task:clone(task),step,signal});
     const check=await verifyStep({task:clone(task),step,output,signal});
     if(check?.verified!==true){task.status='verification_required';task.pendingStep=step.id;break;}
     task.results[step.id]={status:'completed',verified:true};
     task.history.push({stepId:step.id,status:'verified',at:new Date().toISOString()});
    }catch(error){
     const failure=classifyTaskFailure(error);
     task.history.push({stepId:step.id,status:failure.category,at:new Date().toISOString()});
     if(!failure.automaticRetry||attempts>=maxAttempts){task.status=failure.category==='retryable'?'retry_exhausted':failure.category;task.pendingStep=step.id;break;}
    }
    // Durable checkpoint before proceeding to another operation.
    const state=await read();state.tasks[id]=task;
    store.write(state);
   }
   const state=await read();state.tasks[id]=task;
   await mkdir(dirname(file),{recursive:true});
   const temp=file+'.'+randomUUID()+'.tmp';
   await writeFile(temp,JSON.stringify(state,null,2),{mode:0o600,flag:'wx'});await rename(temp,file);
   return clone(task);
  });
 }
 return {register,get,run};
}
