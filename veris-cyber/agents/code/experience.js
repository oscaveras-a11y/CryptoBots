// Sanitized experience records; persistence belongs to an approved host adapter.
export function summarizeExperience(records=[],limit=10) {
 if(!Array.isArray(records)||records.length>100||!Number.isInteger(limit)||limit<1||limit>20)throw new TypeError('invalid_experience');
 const safe=records.filter(x=>x&&typeof x==='object'&&typeof x.topic==='string'&&typeof x.outcome==='string')
  .map(x=>({topic:x.topic.slice(0,120),outcome:x.outcome.slice(0,120),lesson:String(x.lesson??'').slice(0,400)}));
 return {status:'experience_ready',records:safe.slice(-limit),persisted:false};
}
