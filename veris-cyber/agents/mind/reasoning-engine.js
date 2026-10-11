// Deterministic reasoning layer: advisory only, never an execution authority.
const MAX_GOAL=4000;
const SENSITIVE=/\b(?:delete|remove|format|wipe|erase|excluir|apagar|formatar|deletar|mover|move|rename|renomear|substituir|replace|alterar|modificar|install|instalar|executar|execute)\b/i;
const INVESTIGATE=/\b(?:investigar|analisar|diagnosticar|verificar|inspecionar|investigate|analyze|diagnose|inspect|check|testar|test)\b/i;
const SPLIT=/\s*(?:;|\n+|\s+e depois\s+|\s+then\s+)\s*/i;
const clean=s=>s.replace(/\s+/g,' ').trim();
export function reasonAboutGoal({goal,evidence=[],constraints=[],history=[]}={}){
 if(typeof goal!=='string'||!goal.trim()||goal.length>MAX_GOAL)return {status:'invalid_goal',executed:false};
 const normalized=clean(goal);
 const facts=Array.isArray(evidence)?evidence.filter(x=>x&&typeof x.claim==='string'&&typeof x.source==='string'&&x.source.trim()&&x.verified===true).slice(0,20).map(x=>({claim:clean(x.claim).slice(0,500),source:x.source.slice(0,300)})):[];
 const hypotheses=Array.isArray(evidence)?evidence.filter(x=>x&&typeof x.claim==='string'&&x.verified!==true).slice(0,20).map(x=>clean(x.claim).slice(0,500)):[];
 const steps=normalized.split(SPLIT).map(clean).filter(Boolean).slice(0,12);
 const tasks=steps.map((description,index)=>({
  id:index+1,description,
  category:SENSITIVE.test(description)?'change_request':INVESTIGATE.test(description)?'investigation':'analysis',
  status:'proposed',executed:false
 }));
 const needsApproval=tasks.some(x=>x.category==='change_request');
 const safeConstraints=Array.isArray(constraints)?constraints.filter(x=>typeof x==='string').slice(0,15).map(x=>clean(x).slice(0,300)):[];
 const contextTurns=Array.isArray(history)?Math.min(history.length,10):0;
 return {
  status:'reasoned',goal:normalized,tasks,
  facts,hypotheses,unknowns:facts.length===0?['No independently verified evidence was supplied.']:[],
  constraints:safeConstraints,contextTurns,
  nextAction:needsApproval?'request_explicit_action_approval':facts.length===0?'gather_evidence':'review_plan',
  requiresApproval:needsApproval,executed:false,verified:false,
  limitations:['heuristic_task_decomposition','not_a_language_model','does_not_grant_permissions']
 };
}
