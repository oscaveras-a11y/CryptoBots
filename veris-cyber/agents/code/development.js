import { engineeringBrief } from './engineering.js';
export async function developCode(data={},adapters={}) {
 const brief=engineeringBrief({instruction:data.instruction??'',files:data.files??[],diagnostics:data.diagnostics??[]});
 if(typeof adapters.generateChanges!=='function')return {status:'requires_code_generator',brief,executed:false};
 const result=await adapters.generateChanges({instruction:data.instruction??'',files:data.files??[],brief});
 if(!result||!Array.isArray(result.changes)||result.changes.length===0)return {status:'invalid_generated_changes',brief,executed:false};
 return {status:'generated_changes_ready',brief,changes:result.changes,executed:false};
}
