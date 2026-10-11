import {prepareWindowsAssessment} from './windows-assessment.js';

// Build an auditable assessment manifest. Network checks require a trusted adapter.
export function createWindowsMission({computer,authorization,mode='both'}={}){
 const plan=prepareWindowsAssessment({computer,authorization});
 if(plan.status!=='assessment_ready')return plan;
 if(!['local','network','both'].includes(mode))return {status:'invalid_mode',executed:false};
 const selected=plan.checks.filter(x=>x.phase==='review'||mode==='both'||x.phase===mode);
 return {...plan,mode,checks:selected,stopOnAuthorizationLoss:true,requireEvidence:true,requiresManualApproval:true};
}
