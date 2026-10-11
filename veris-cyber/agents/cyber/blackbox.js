import {randomUUID} from 'node:crypto';

// Scope-first black-box assessment planner. Does not probe a network.
const hostPattern=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
function validateTargets(targets){
 if(!Array.isArray(targets)||targets.length===0||targets.length>30)throw new TypeError('invalid_targets');
 const clean=[...new Set(targets)];
 for(const target of clean){
  if(typeof target!=='string'||target.length>253||!hostPattern.test(target)||target==='localhost')throw new TypeError('invalid_target');
 }
 return clean;
}
export function planBlackBoxAssessment({targets,authorization,checks=['http_headers','tls_metadata','public_routes']}={}){
 const scoped=validateTargets(targets);
 if(!authorization||authorization.confirmed!==true||typeof authorization.reference!=='string'||!authorization.reference.trim()||!Array.isArray(authorization.targets)||scoped.some(t=>!authorization.targets.includes(t)))return {status:'authorization_required',executed:false};
 const allowed=new Set(['http_headers','tls_metadata','public_routes']);
 if(!Array.isArray(checks)||!checks.length||checks.some(x=>!allowed.has(x)))throw new TypeError('unsupported_check');
 return {status:'plan_ready',assessmentId:randomUUID(),executed:false,targets:scoped,checks:[...new Set(checks)],authorizationReference:authorization.reference,requiresTrustedAuthorization:true,requiresIsolatedRunner:true,requiresApprovalBeforeExecution:true,limitations:['no_network_probe_performed','authorization_claim_not_independently_verified']};
}
