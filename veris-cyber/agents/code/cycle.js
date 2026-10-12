import { engineeringBrief } from './engineering.js';
import { retrieveCodeContext } from './context-retrieval.js';

// Host supplies model, isolated runner and persistence; this module never runs commands.
export async function runDevelopmentCycle(input={}, adapters={}) {
 const {instruction='',files=[],diagnostics=[],maxAttempts=2}=input;
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw new TypeError('invalid_attempt_limit');
 const brief=engineeringBrief({instruction,files,diagnostics});
 if(typeof adapters.generateChanges!=='function')return {status:'requires_code_generator',brief,attempts:0};
 if(typeof adapters.prepareChanges!=='function')return {status:'requires_proposal_validator',brief,attempts:0};
 if(typeof adapters.runChecks!=='function')return {status:'requires_isolated_test_runner',brief,attempts:0};
 const history=[];
 const context=retrieveCodeContext({instruction,files,limit:8,maxChars:12000});
 let feedback=diagnostics;
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const output=await adapters.generateChanges({instruction,files,brief,context,feedback,attempt});
  if(!output||!Array.isArray(output.changes)||output.changes.length===0)
   return {status:'invalid_generated_changes',brief,attempts:attempt,history};
  let proposal,checks;
  try {
   proposal=adapters.prepareChanges(files,output.changes);
   checks=await adapters.runChecks({proposal,files,attempt});
  } catch(error) {
   const message=error instanceof Error?error.message:String(error);
   history.push({attempt,passed:false,error:message});
   feedback=[{source:'validation',message}];
   continue;
  }
  if(!checks||!Array.isArray(checks.testResults)||!Array.isArray(checks.staticAnalysis))
   return {status:'invalid_test_evidence',brief,attempts:attempt,history};
  const records=[...checks.testResults,...checks.staticAnalysis];
  const passed=checks.testResults.length>0&&checks.staticAnalysis.length>0&&checks.runnerResult?.status==='passed'&&checks.runnerResult?.executed===true&&records.every(x=>x?.status==='passed');
  history.push({attempt,proposalId:proposal.proposalId,passed,checks});
  if(passed)return {status:'review_required',brief,proposal,attempts:attempt,history,verified:false,requiresApproval:true};
  feedback=records.filter(x=>x?.status!=='passed').map(x=>({source:String(x?.source??'runner'),message:String(x?.message??x?.name??'failed')}));
 }
 return {status:'checks_failed',brief,attempts:maxAttempts,history,verified:false};
}
