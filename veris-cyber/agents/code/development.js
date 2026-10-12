import { engineeringBrief } from './engineering.js';
export async function developCode(data={},adapters={}) {
 const brief=engineeringBrief({instruction:data.instruction??'',files:data.files??[],diagnostics:data.diagnostics??[]});
 if(typeof adapters.generateChanges!=='function')return {status:'requires_code_generator',brief,executed:false};
 const result=await adapters.generateChanges({instruction:data.instruction??'',files:data.files??[],brief});
 if(!result||!Array.isArray(result.changes)||result.changes.length===0)return {status:'invalid_generated_changes',brief,executed:false};
 if(typeof adapters.prepareChanges!=='function')return {status:'requires_proposal_validator',brief,executed:false};
 const proposal=adapters.prepareChanges(data.files??[],result.changes);
 if(typeof adapters.runChecks!=='function')return {status:'proposal_requires_tests',brief,proposal,executed:false,verified:false,requiresApproval:true};
 const evidence=await adapters.runChecks({proposal,files:data.files??[]});
 return {status:'proposal_checks_reported',brief,proposal,evidence,executed:false,verified:false,requiresApproval:true};
}
