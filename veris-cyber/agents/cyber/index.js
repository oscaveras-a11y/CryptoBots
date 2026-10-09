import { checkScope } from '../guard/index.js';
export default function cyber({ instruction = '', scope = '', data = {} } = {}) {
  const decision = checkScope({ target: data?.target, activity: data?.activity, authorization: data?.authorization });
  if (!decision.allowed) return { status: 'blocked', reason: decision.reason, findings: [], executed: false };
  return { status: 'requires_scanner_and_execution_approval', instruction, scope, target: data.target, activity: data.activity, findings: [], executed: false };
}
