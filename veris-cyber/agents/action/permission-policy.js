// Separate security assessment permissions from explicit file-change grants.
// This is a policy module, not an operating-system privilege escalation mechanism.
export function authorizeJarvisAction(request, grant) {
 if (!request || typeof request !== 'object') return {allowed:false,reason:'invalid_request'};
 const {kind,operation,target}=request;
 if (kind==='assessment') {
  if (!grant || grant.kind!=='assessment' || grant.approved!==true) return {allowed:false,reason:'assessment_approval_required'};
  if (!Array.isArray(grant.targets)||!grant.targets.includes(target)) return {allowed:false,reason:'outside_scope'};
  if (!Array.isArray(grant.operations)||!grant.operations.includes(operation)) return {allowed:false,reason:'operation_not_permitted'};
  return {allowed:true};
 }
 if (kind==='file_change') {
  if (!['rename','move','replace','delete'].includes(operation)) return {allowed:false,reason:'operation_not_permitted'};
  if (!grant || grant.kind!=='file_change' || grant.approved!==true || grant.confirmed!==true) return {allowed:false,reason:'explicit_confirmation_required'};
  if (typeof target!=='string'||!target.trim()||target.includes('\0')) return {allowed:false,reason:'invalid_target'};
  if (grant.operation!==operation || grant.target!==target) return {allowed:false,reason:'grant_mismatch'};
  if (['rename','move','replace'].includes(operation) && (typeof request.destination!=='string'||!request.destination.trim()||grant.destination!==request.destination)) return {allowed:false,reason:'destination_not_approved'};
  return {allowed:true};
 }
 return {allowed:false,reason:'unknown_action_kind'};
}
