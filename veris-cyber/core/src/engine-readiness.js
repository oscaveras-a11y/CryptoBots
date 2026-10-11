// Cross-agent readiness audit: no capability is claimed without a trusted adapter.
export const ENGINE_NAMES=Object.freeze(['sense','mind','memory','planner','research','vision','voice','code','cyber','action','guard','verify']);
const REQUIREMENTS=Object.freeze({
 sense:[],mind:['generateText'],memory:[],planner:[],research:['retrieve'],
 vision:['analyzeImages'],voice:['transcribeAudio','synthesizeSpeech'],
 code:['readScoped','runChecks'],cyber:['cyberOperation'],
 action:['executeAction'],guard:['checkActionPermission','checkCodePermission'],verify:[]
});
export function auditEngineReadiness(adapters={}){
 if(!adapters||typeof adapters!=='object'||Array.isArray(adapters))throw new TypeError('invalid_engine_adapters');
 const engines=ENGINE_NAMES.map(name=>{
  const required=REQUIREMENTS[name];
  const missing=required.filter(key=>typeof adapters[key]!=='function');
  return {name,status:missing.length?'adapter_required':'base_available',missing,autonomous: false};
 });
 return {status:'diagnostic_only',engines,fullyIntegrated: false,limitations:['base_available_does_not_mean_independent_intelligence','adapters_do_not_prove_execution_or_permissions']};
}
// Recoverable failures can be retried; authorization failures must stop and request human input.
export function classifyTaskFailure(error){
 const code=typeof error==='string'?error:typeof error?.code==='string'?error.code:typeof error?.message==='string'?error.message:'unknown';
 const authorization=/approv|authoriz|permission|forbidden|scope|denied|out_of_scope/i.test(code);
 const transient=/timeout|temporar|unavailable|econnreset|econnrefused|rate.limit|network/i.test(code);
 return {code:code.slice(0,200),category:authorization?'authorization_required':transient?'retryable':'investigation_required',automaticRetry:!authorization&&transient};
}
