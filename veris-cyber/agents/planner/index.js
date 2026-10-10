const AGENTS = new Set(['research', 'vision', 'voice', 'code', 'cyber', 'action']);
const MAX_MESSAGE = 4000;
export default function planner({ message = '', data = {} } = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) throw new TypeError('invalid_plan_request');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('invalid_plan_data');
  const agent = data.requestedAgent;
  if (!AGENTS.has(agent)) return { steps: [], requiresSelection: true, reason: 'agent_not_selected' };
  if (agent === 'cyber') {
    const auth = data.authorization;
    if (auth?.confirmed !== true || typeof data.target !== 'string' || !data.target.trim() || typeof data.activity !== 'string' || !data.activity.trim()) {
      return { steps: [], requiresSelection: true, reason: 'explicit_pentest_scope_required' };
    }
  }
  // No agent is allowed to turn a plan into authorization.
  return { steps: [{ agent, instruction: message.trim().slice(0, 1000) }], requiresSelection: false };
}
