// Explicitly supplied examples; no claims of model training.
export const codeExamples = [
 {id:'node-input',language:'javascript',problem:'Validate API input',solution:"export function validId(value) { return Number.isSafeInteger(value) && value > 0; }",tests:["validId(1) === true","validId(-1) === false"]},
 {id:'python-counter',language:'python',problem:'Count repeated items',solution:"from collections import Counter\ndef frequencies(items):\n    return dict(Counter(items))",tests:["frequencies(['a','a','b']) == {'a': 2, 'b': 1}"]},
 {id:'sql-safe',language:'sql',problem:'Use parameterized queries',solution:"SELECT id, name FROM users WHERE id = ?;",tests:["Bind id through database driver rather than interpolation"]},
 {id:'js-retry',language:'javascript',problem:'Bound retries',solution:"export async function retry(task, attempts = 2) { for (let i = 0; i < attempts; i++) { try { return await task(); } catch (error) { if (i === attempts - 1) throw error; } } }",tests:["Reject after final attempt","Return successful result"]}
];
export function findCodeExamples(topic='',limit=3) {
 if(typeof topic!=='string'||!Number.isInteger(limit)||limit<1||limit>4)throw new TypeError('invalid_example_query');
 const words=topic.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 return {status:'examples_ready',examples:codeExamples.filter(x=>words.length===0||words.some(w=>(x.id+' '+x.language+' '+x.problem).toLowerCase().includes(w))).slice(0,limit)};
}
