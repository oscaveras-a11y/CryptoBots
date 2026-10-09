const AGENTS = new Set(['research', 'vision', 'voice', 'code', 'cyber', 'action']);
export default function planner({ message = '', data = {} } = {}) {
  if (typeof message !== 'string' || !message.trim()) throw new TypeError('invalid_plan_request');
  const agent = data?.requestedAgent;
  if (!AGENTS.has(agent)) return { steps: [], requiresSelection: true, reason: 'agent_not_selected' };
  if (agent === 'cyber') {
    const auth = data?.authorization;
    if (auth?.confirmed !== true || !data?.target || !data?.activity) {
      return { steps: [], requiresSelection: false, reason: 'explicit_pentest_scope_required' };
    }
  }
  return { steps: [{ agent, instruction: message.slice(0, 1000) }], requiresSelection: false };
}
