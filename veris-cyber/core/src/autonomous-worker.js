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
 const namespace='worker-'+createHash('sha256').update(file).digest('hex').slice(0,40);
 const store=createStateStore({namespace,file});
 const lease=createStateStore({namespace:namespace+'-lease'});
 const owner=createHash('sha256').update(String(process.pid)+':'+Math.random()).digest('hex');
 let queue=Promise.resolve();
 async function read(){return store.read({version:1,tasks:{}});}
 function serialized(fn){const next=queue.then(fn);queue=next.then(()=>{},()=>{});return next;}
 async function mutate(fn){return serialized(async()=>{
  return store.update({version:1,tasks:{}},state=>fn(state));
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
  // Acquire a cross-process lease; never replay an in-flight side effect after expiry.
  return serialized(async()=>{
   const acquired=lease.update({owner:null,until:0},state=>{
    if(state.owner&&state.until>Date.now()&&state.owner!==owner)return false;
    state.owner=owner;state.until=Date.now()+300000;return true;
   });
   if(!acquired)throw new Error('task_already_running');
   try {
   let task=(await read()).tasks[id];if(!task)throw new Error('task_not_found');
   if(task.status!=='active')return clone(task);
   // Work is performed outside mutate's queue; this serialized lock prevents concurrent runs on this instance.
   for(let count=0;count<stepBudget;count++){
    if(signal?.aborted)return clone({...task,status:'interrupted'});
    const plan=nextPlanSteps(task.steps,task.results,1);
    if(plan.status==='completed'){task.status='awaiting_review';break;}
    if(!plan.ready.length){task.status=plan.status;break;}
    const step=plan.ready[0];
    if(task.inFlight?.stepId===step.id){task.status='verification_required';task.pendingStep=step.id;break;}
    const permission=await authorizeStep({task:clone(task),step});
    if(permission?.allowed!==true){task.status='authorization_required';task.pendingStep=step.id;break;}
    const attempts=(task.attempts[step.id]??0)+1;task.attempts[step.id]=attempts;
    try{
     task.inFlight={stepId:step.id,at:new Date().toISOString()};
     store.update({version:1,tasks:{}},state=>{state.tasks[id]=task;return true;});
     const output=await executeStep({task:clone(task),step,signal});
     const check=await verifyStep({task:clone(task),step,output,signal});
     if(check?.verified!==true){task.status='verification_required';task.pendingStep=step.id;break;}
     task.results[step.id]={status:'completed',verified:true};
     delete task.inFlight;
     task.history.push({stepId:step.id,status:'verified',at:new Date().toISOString()});
    }catch(error){
     const failure=classifyTaskFailure(error);
     task.history.push({stepId:step.id,status:failure.category,at:new Date().toISOString()});
     if(!failure.automaticRetry||attempts>=maxAttempts){task.status=failure.category==='retryable'?'retry_exhausted':failure.category;task.pendingStep=step.id;break;}
    }
    // Durable checkpoint before proceeding to another operation.
    store.update({version:1,tasks:{}},state=>{state.tasks[id]=task;return true;});
   }
   store.update({version:1,tasks:{}},state=>{state.tasks[id]=task;return true;});
   return clone(task);
   }finally{lease.update({owner:null,until:0},state=>{if(state.owner===owner){state.owner=null;state.until=0;}return true;});}
  });
 }
 return {register,get,run,close:()=>{store.close();lease.close();}};
}
