import { advancedLessons } from './advanced-knowledge.js';
import { languageLessons } from './language-knowledge.js';
// Curated software-engineering playbook, not model training or autonomous code generation.
const lessons = [
 {id:'requirements',tags:['design','architecture','planning'],title:'Define contracts before coding',guidance:'Identify user-visible behavior, inputs, outputs, failure modes, constraints and acceptance criteria. Separate assumptions from verified facts.',checks:['Write acceptance criteria','List edge cases','Define API and data contracts']},
 {id:'architecture',tags:['architecture','design','refactor'],title:'Prefer cohesive boundaries',guidance:'Keep modules focused; isolate I/O behind interfaces; avoid cyclic dependencies; document ownership of state and side effects.',checks:['Map dependencies','Review coupling','Specify interfaces']},
 {id:'javascript',tags:['javascript','typescript','node','async'],title:'Reliable JavaScript and TypeScript',guidance:'Validate untrusted inputs, use explicit async error handling, respect AbortSignal and timeouts, avoid implicit coercion and mutable shared state.',checks:['Test async failures','Validate input','Handle cancellation']},
 {id:'python',tags:['python','testing','types'],title:'Maintainable Python',guidance:'Use type hints, context managers, small functions, explicit exceptions and isolated virtual environments; avoid mutable default arguments.',checks:['Run type checks','Test exceptions','Pin dependencies']},
 {id:'database',tags:['sql','database','sqlite','migration'],title:'Safe database evolution',guidance:'Use parameterized queries, transactions and versioned migrations. Check indexes using real query plans and test rollback.',checks:['Test migration on copy','Review query plans','Test constraints']},
 {id:'security',tags:['security','auth','api'],title:'Secure by default',guidance:'Apply least privilege, deny by default, server-side authorization, bounded input, secret isolation and safe logging. Never trust a UI permission flag.',checks:['Test unauthorized access','Review secret handling','Validate boundaries']},
 {id:'testing',tags:['test','testing','debug','verify'],title:'Test behavior and regressions',guidance:'Create deterministic unit tests and integration tests, include negative paths and regression cases. Do not call unexecuted tests passing.',checks:['Reproduce bug','Run relevant tests','Check regressions']},
 {id:'debugging',tags:['debug','diagnostic','errors'],title:'Debug from evidence',guidance:'Reproduce, isolate, form falsifiable hypotheses, inspect logs and stack traces, change one variable at a time and verify the fix.',checks:['Capture failing case','Identify root cause','Verify fix']},
 {id:'performance',tags:['performance','memory','latency'],title:'Optimize measured bottlenecks',guidance:'Establish a baseline, profile before optimizing, assess algorithmic complexity and memory, and compare performance with correctness intact.',checks:['Record baseline','Profile hotspot','Benchmark regression']},
 {id:'review',tags:['review','refactor','quality'],title:'Review changes as a maintainer',guidance:'Prefer small diffs, preserve public contracts, verify compatibility, add tests and document tradeoffs. Never bypass approval for production changes.',checks:['Review diff','Check compatibility','Confirm rollback path']}
];
export function getCodeKnowledge({topic='',limit=5}={}) {
 if(typeof topic!=='string'||topic.length>300||!Number.isInteger(limit)||limit<1||limit>10)throw new TypeError('invalid_knowledge_query');
 const tokens=[...new Set(topic.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))];
 const ranked=[...lessons,...advancedLessons,...languageLessons].map((lesson,index)=>({
  lesson,index,score:tokens.reduce((score,token)=>score+(lesson.tags.some(tag=>tag.includes(token))?3:0)+(lesson.title.toLowerCase().includes(token)?2:0),0)
 })).sort((a,b)=>b.score-a.score||a.index-b.index);
 return {status:'knowledge_ready',topic,lessons:ranked.slice(0,limit).map(({lesson})=>({...lesson})),
  workflow:['understand','inspect','design','implement','test','review','request_approval'],
  limitations:['curated_guidance_not_model_training','no_semantic_code_generation','no_execution']};
}
