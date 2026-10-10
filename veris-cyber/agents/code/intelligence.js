// CODE reasoning utilities operate on supplied project metadata and diagnostics.
// No shell execution, filesystem mutation, or model invocation.
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const allowed = new Set(['correctness','security','performance','maintainability','compatibility']);
export function mapArchitecture(files) {
  if (!Array.isArray(files) || files.length > 200) throw new TypeError('invalid_files');
  const nodes = files.map(file => {
    if (!file || !nonempty(file.path) || typeof file.content !== 'string') throw new TypeError('invalid_file');
    const dependencies = [];
    const pattern = /(?:from\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
    for (const match of file.content.matchAll(pattern)) {
      if (dependencies.length < 50) dependencies.push(match[1].slice(0, 160));
    }
    return { path: file.path, dependencies: [...new Set(dependencies)] };
  });
  return { status: 'architecture_mapped', executed: false, nodes,
    unresolved: nodes.flatMap(node => node.dependencies.filter(dep => dep.startsWith('.')).map(dep => ({from:node.path,dependency:dep}))),
    limitations: ['static_imports_only','resolution_not_performed'] };
}
export function rankSolutions(options) {
  if (!Array.isArray(options) || options.length < 1 || options.length > 12) throw new TypeError('invalid_options');
  const ranked = options.map((option,index) => {
    if (!option || !nonempty(option.name) || !allowed.has(option.goal) ||
      !Number.isInteger(option.risk) || option.risk < 0 || option.risk > 5 ||
      !Number.isInteger(option.complexity) || option.complexity < 0 || option.complexity > 5 ||
      !Number.isInteger(option.testability) || option.testability < 0 || option.testability > 5) throw new TypeError('invalid_option');
    return {name:option.name.slice(0,120),goal:option.goal,risk:option.risk,complexity:option.complexity,
      testability:option.testability,score:option.testability*3-option.risk*3-option.complexity*2,index};
  }).sort((a,b)=>b.score-a.score || a.index-b.index);
  return {status:'solutions_ranked',executed:false,ranking:ranked,requiresHumanReview:true,
    limitations:['heuristic_scoring_only','no_semantic_correctness_assessment']};
}
export function diagnoseFailures(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length > 100) throw new TypeError('invalid_diagnostics');
  const failures = diagnostics.map((item,index) => {
    if (!item || !nonempty(item.message) || !nonempty(item.source)) throw new TypeError('invalid_diagnostic');
    const message = item.message.slice(0,500);
    const category = /syntaxerror|unexpected token|parse error/i.test(message) ? 'syntax'
      : /module not found|cannot find module/i.test(message) ? 'dependency'
      : /timeout|timed out/i.test(message) ? 'timeout'
      : /assertionerror|expected|actual/i.test(message) ? 'assertion' : 'unknown';
    return {id:index+1,source:item.source.slice(0,160),category,message,
      nextStep:category==='syntax'?'Review the reported syntax location'
        :category==='dependency'?'Check dependency declarations and module resolution'
        :category==='timeout'?'Inspect blocking operations and resource limits'
        :category==='assertion'?'Compare expected and actual behavior':'Investigate the full diagnostic trace'};
  });
  return {status:'diagnostics_ready',executed:false,failures,limitations:['pattern_based_triage_only']};
}
export function planRefactor(changes) {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 20) throw new TypeError('invalid_refactor');
  const steps = changes.map((change,index) => {
    if (!change || !nonempty(change.path) || !nonempty(change.objective)) throw new TypeError('invalid_refactor_step');
    return {id:'change-'+(index+1),path:change.path.slice(0,260),objective:change.objective.slice(0,500),
      requiresReview:true,requiresTests:true};
  });
  return {status:'refactor_planned',executed:false,steps,
    validation:['check_baseline_hashes','review_proposed_diff','run_isolated_tests','approve_before_staging']};
}
