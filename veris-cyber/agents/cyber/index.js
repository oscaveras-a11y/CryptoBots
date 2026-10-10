import { checkScope } from '../guard/index.js';

export default async function cyber({ instruction = '', scope = '', data = {} } = {}, context = {}) {
  const decision = checkScope({
    target: data?.target,
    activity: data?.activity,
    authorization: data?.authorization
  });
  if (!decision.allowed) {
    return { status: 'blocked', reason: decision.reason, findings: [], executed: false };
  }
  if (context.signal?.aborted) throw new Error('cyber_aborted');
  if (typeof context.cyberOperation !== 'function') {
    return {
      status: 'requires_scanner_and_execution_approval',
      instruction, scope, target: data.target, activity: data.activity,
      findings: [], executed: false
    };
  }
  const result = await context.cyberOperation(data);
  if (context.signal?.aborted) throw new Error('cyber_aborted');
  if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.status !== 'string') {
    throw new Error('invalid_cyber_result');
  }
  return result;
}
