// Trusted CODE task permissions: default deny. This module does not authenticate users.
const OPERATIONS = new Set(['action-read','action-create','inspect','security-audit','propose','stage','test','review','describe','rollback']);
const isList = value => Array.isArray(value) && value.every(x => typeof x === 'string' && x.length > 0 && x.length <= 260);
function match(pattern, path) {
  return pattern === path || (pattern.endsWith('/**') && path.startsWith(pattern.slice(0,-3) + '/'));
}
function allowed(path, allow, deny) {
  return allow.some(x => match(x,path)) && !deny.some(x => match(x,path));
}
export function authorizeCodeTask(policy, {operation,project,paths=[]} = {}) {
  if (!policy || policy.confirmed !== true || !OPERATIONS.has(operation) || policy.project !== project ||
      !isList(policy.operations) || !policy.operations.includes(operation) ||
      !isList(policy.allowPaths) || !isList(policy.denyPaths) || !isList(paths) ||
      !Number.isFinite(policy.expiresAt) || Date.now() >= policy.expiresAt) return {allowed:false,reason:'task_permission_required'};
  if (paths.some(path => !allowed(path,policy.allowPaths,policy.denyPaths))) return {allowed:false,reason:'path_out_of_scope'};
  return {allowed:true,reason:'within_task_scope'};
}
// Only trusted host can create and store these grants. Caller-supplied policy objects are not trusted.
export function createCodePermissionStore({ clock = () => Date.now() } = {}) {
  const grants = new Map();
  return {
    grant(id, policy) {
      if (typeof id !== 'string' || !id || grants.has(id) || !policy || !Number.isFinite(policy.expiresAt) || policy.expiresAt <= clock()) throw new TypeError('invalid_grant');
      grants.set(id, structuredClone(policy));
    },
    check(id, request, { consume = false } = {}) {
      const policy = grants.get(id);
      const result = authorizeCodeTask(policy,request);
      if (!policy || clock() >= policy.expiresAt) {grants.delete(id);return {allowed:false,reason:'task_permission_required'};}
      if (result.allowed && consume) grants.delete(id);
      return result;
    },
    revoke(id) { return grants.delete(id); }
  };
}
