import {evaluateMissionStep} from './mission-policy.js';
export async function runCyberMission(mission,steps,runner,verified=false){
 if(!Array.isArray(steps)||steps.length>100)return {status:'invalid_steps'};
 if(typeof runner!=='function')return {status:'runner_required'};
 const results=[];
 for(const step of steps){
  const permission=evaluateMissionStep(mission,step,verified);
  if(!permission.allowed){results.push({step,status:'blocked',reason:permission.reason});continue;}
  try{results.push({step,status:'completed',result:await runner(step)});}
  catch{results.push({step,status:'failed'});}
 }
 return {status:'completed',results};
}
