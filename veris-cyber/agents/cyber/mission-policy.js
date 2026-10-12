export function evaluateMissionStep(mission,step,verified=false){
 if(!mission||!step||typeof step.target!=='string'||typeof step.operation!=='string')return {allowed:false,reason:'invalid_step'};
 const excluded=mission.excludedTargets??[];
 const targets=mission.targets??[];
 const operations=mission.operations??[];
 if(excluded.some(x=>step.target===x||step.target.endsWith('.'+x)))return {allowed:false,reason:'excluded_target'};
 if(!targets.some(x=>step.target===x||step.target.endsWith('.'+x)))return {allowed:false,reason:'outside_scope'};
 if(!operations.includes(step.operation))return {allowed:false,reason:'operation_not_permitted'};
 if(!verified)return {allowed:false,reason:'authorization_unverified'};
 return {allowed:true};
}
