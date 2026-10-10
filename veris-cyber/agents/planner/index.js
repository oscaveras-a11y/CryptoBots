// Deterministic, bounded planning. Plans are proposals, never authorizations.
const AGENTS = new Set(['research','vision','voice','code','cyber','action']);
const MAX_STEPS = 12;
const MAX_INSTRUCTION = 1000;
const hasText = x => typeof x === 'string' && x.trim().length > 0;
export function validatePlan(steps) {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > MAX_STEPS) throw new TypeError('invalid_plan_size');
  const ids = new Set();
  const normalized = steps.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step) || !AGENTS.has(step.agent) || !hasText(step.instruction) || step.instruction.length > MAX_INSTRUCTION) throw new TypeError('invalid_plan_step');
    const id = step.id ?? 'step-' + (index + 1);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || ids.has(id)) throw new TypeError('invalid_step_id');
    ids.add(id);
    const dependsOn = step.dependsOn ?? [];
    if (!Array.isArray(dependsOn) || dependsOn.some(d => typeof d !== 'string') || new Set(dependsOn).size !== dependsOn.length) throw new TypeError('invalid_dependencies');
    return { id, agent: step.agent, instruction: step.instruction.trim(), dependsOn: [...dependsOn], priority: step.priority ?? 0 };
  });
  for (const step of normalized) {
    if (step.dependsOn.some(id => !ids.has(id) || id === step.id)) throw new TypeError('invalid_dependencies');
    if (!Number.isInteger(step.priority) || step.priority < -10 || step.priority > 10) throw new TypeError('invalid_priority');
  }
  const visited = new Set(), visiting = new Set(), byId = new Map(normalized.map(s => [s.id,s]));
  function visit(id) {
    if (visiting.has(id)) throw new TypeError('cyclic_plan');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const step of normalized) visit(step.id);
  return normalized;
}
export function planWaves(steps, concurrency = 3) {
  const plan = validatePlan(steps);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new TypeError('invalid_concurrency');
  const done = new Set(), waves = [];
  while (done.size < plan.length) {
    const ready = plan.filter(s => !done.has(s.id) && s.dependsOn.every(d => done.has(d)))
      .sort((a,b) => b.priority-a.priority || plan.indexOf(a)-plan.indexOf(b));
    const wave = ready.slice(0,concurrency);
    if (!wave.length) throw new TypeError('cyclic_plan');
    waves.push(wave.map(s => s.id));
    for (const step of wave) done.add(step.id);
  }
  return waves;
}
// Structural diagnostics: identify bottlenecks without claiming runtime speedups.
export function analyzePlan(steps, concurrency = 3) {
  const plan = validatePlan(steps);
  const waves = planWaves(plan, concurrency);
  const depth = new Map();
  for (const wave of waves) {
    for (const id of wave) {
      const step = plan.find(item => item.id === id);
      depth.set(id, 1 + Math.max(0, ...step.dependsOn.map(dep => depth.get(dep))));
    }
  }
  const criticalDepth = Math.max(...depth.values());
  const criticalSteps = plan.filter(step => depth.get(step.id) === criticalDepth).map(step => step.id);
  return {
    stepCount: plan.length,
    waveCount: waves.length,
    maxParallelWidth: Math.max(...waves.map(w => w.length)),
    criticalDepth,
    criticalSteps,
    agents: [...new Set(plan.map(step => step.agent))],
    containsExecution: plan.some(step => ['action','code','cyber'].includes(step.agent)),
    waves
  };
}
export default function planner({ message = '', data = {} } = {}) {
  if (!hasText(message) || message.length > 4000) throw new TypeError('invalid_plan_request');
  const requested = data?.requestedAgent;
  if (!AGENTS.has(requested)) return { steps: [], requiresSelection: true, reason: 'agent_not_selected' };
  if (requested === 'cyber') {
    if (data?.authorization?.confirmed !== true || !data?.target || !data?.activity)
      return { steps: [], requiresSelection: false, reason: 'explicit_pentest_scope_required' };
  }
  // Explicit plans are data, not free-form model output. Each step remains subject to CORE GUARD.
  const candidate = Array.isArray(data?.planSteps) ? data.planSteps : [{ agent: requested, instruction: message.slice(0,MAX_INSTRUCTION) }];
  try {
    const steps = validatePlan(candidate);
    // Do not allow caller-supplied plans to bypass explicit agent selection.
    if (steps.some(s => s.agent !== requested) && data?.allowMultiAgentPlan !== true)
      return { steps: [], requiresSelection: true, reason: 'multi_agent_confirmation_required' };
    if (steps.some(s => s.agent === 'cyber') && (data?.authorization?.confirmed !== true || !data?.target || !data?.activity))
      return { steps: [], requiresSelection: false, reason: 'explicit_pentest_scope_required' };
    return { steps, waves: planWaves(steps), analysis: analyzePlan(steps), requiresSelection: false, execution: 'requires_guard_and_authorization' };
  } catch (error) {
    return { steps: [], requiresSelection: true, reason: error instanceof Error ? error.message : 'invalid_plan' };
  }
}
