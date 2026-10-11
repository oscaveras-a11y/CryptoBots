import {evaluateMissionStep} from './mission-policy.js';

// Dispatches permitted steps through a trusted host-provided adapter.
export async function runCyberMission(mission,steps,runner,verified=false){
 if(!Array.isArray(steps)||steps.length===0||steps.length>100)return {status:'invalid_steps',executed:false,results:[]};
 if(typeof runner!=='function')return {status:'runner_required',executed:false,results:[]};
 const results=[];
 for(const step of steps){
  const permission=evaluateMissionStep(mission,step,verified);
  if(!permission.allowed){results.push({step,status:'blocked',reason:permission.reason});continue;}
  try{
   const output=await runner({target:step.target,operation:step.operation});
   results.push({step,status:'completed',result:output});
  }catch{
   results.push({step,status:'failed',reason:'adapter_error'});
  }
 }
 return {status:'completed',executed:results.some(x=>x.status==='completed'),results};
}
