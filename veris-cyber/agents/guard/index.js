const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const valid = value => typeof value === 'string' && value.trim().length > 0;
export function checkScope({ target, activity, authorization } = {}) {
  if (!authorization || authorization.confirmed !== true) return { allowed: false, reason: 'authorization_not_confirmed' };
  if (!valid(target) || !valid(activity)) return { allowed: false, reason: 'target_and_activity_required' };
  if (!Array.isArray(authorization.targets) || !Array.isArray(authorization.activities)) return { allowed: false, reason: 'explicit_allowlists_required' };
  if (!authorization.targets.some(x => normalize(x) === normalize(target))) return { allowed: false, reason: 'target_out_of_scope' };
  if (!authorization.activities.some(x => normalize(x) === normalize(activity))) return { allowed: false, reason: 'activity_out_of_scope' };
  if ((authorization.deniedTargets || []).some(x => normalize(x) === normalize(target))) return { allowed: false, reason: 'target_explicitly_denied' };
  if ((authorization.deniedActivities || []).some(x => normalize(x) === normalize(activity))) return { allowed: false, reason: 'activity_explicitly_denied' };
  return { allowed: true, reason: 'within_declared_scope' };
}
export default function guard({ authorized = false, scope = '', data = {} } = {},context={}) {
  if (authorized !== true || !valid(scope)) return { allowed: false, allowExecution: false, reason: 'authorization_and_scope_required' };
  if(data.requestedAgent==='action' && typeof context.checkActionPermission==='function'){
    const permission=context.checkActionPermission(data);return {...permission,allowExecution:permission.allowed===true};
  }
  if(data.requestedAgent==='code' && typeof context.checkCodePermission==='function'){
    const permission=context.checkCodePermission({operation:data.operation,project:data.project,permissionId:data.permissionId});
    return {...permission,allowExecution:permission.allowed===true};
  }
  const authorization = data?.authorization;
  const target = data?.target;
  const activity = data?.activity;
  const check = checkScope({ target, activity, authorization });
  return { ...check, allowExecution: false, reason: check.allowed ? 'separate_execution_approval_required' : check.reason };
}
