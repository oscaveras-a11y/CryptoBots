import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const dbPath = resolve(process.env.VERIS_MEMORY_PATH || 'veris-cyber/data/memory.json');
const sqlite = process.env.VERIS_MEMORY_BACKEND === 'sqlite' ? (await import('./sqlite-store.js')).createSqliteMemory() : null;
const normalize = text => text.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
let queue = Promise.resolve();
const serialized = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
async function load() {
  try {
    const value = JSON.parse(await readFile(dbPath, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
async function save(value) {
  await mkdir(dirname(dbPath), { recursive: true });
  const temp = dbPath + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, dbPath);
}
export async function storeVerified(question, answer, { source = 'verified', scope = 'default' } = {}) {
  if (typeof question !== 'string' || typeof answer !== 'string' || !question.trim() || !answer.trim() || question.length > 4000 || answer.length > 8000) throw new TypeError('invalid_memory');
  if (typeof scope !== 'string' || !scope.trim() || scope.length > 200) throw new TypeError('invalid_scope');
  if(sqlite)return sqlite.storeVerified(question,answer,{source,scope});
  return serialized(async () => {
    const records = await load();
    records[JSON.stringify([scope, normalize(question)])] = { answer: answer.trim(), source, verified: true, savedAt: new Date().toISOString() };
    await save(records);
    return { stored: true, persistence: 'file', scope };
  });
}
export default async function memory({ message = '', data = {} } = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new TypeError('invalid_memory_query');
  const scope = typeof data?.memoryScope === 'string' && data.memoryScope.trim() ? data.memoryScope : 'default';
  if(sqlite)return sqlite.recall(message,{scope});
  return serialized(async () => {
    const records = await load();
    const item = records[JSON.stringify([scope, normalize(message)])];
    return { verified: item?.verified === true, answer: item?.verified === true ? item.answer : null, source: item?.source ?? null, savedAt: item?.savedAt ?? null, persistence: 'file' };
  });
}

export async function storeExperience({ scope, project, summary, outcome = 'unknown', verified = false, source = 'agent', taskId = null } = {}) {
  if (![scope, project, summary].every(v => typeof v === 'string' && v.trim()) || summary.length > 4000) throw new TypeError('invalid_experience');
  if (!['success', 'failure', 'unknown'].includes(outcome)) throw new TypeError('invalid_outcome');
  if(sqlite)return sqlite.storeExperience({scope,project,summary,outcome,verified,source,taskId});
  return serialized(async () => {
    const records = await load();
    const key = JSON.stringify(['experience', scope, project, randomUUID()]);
    records[key] = { summary: summary.trim(), outcome, verified: verified === true, source, taskId, savedAt: new Date().toISOString() };
    await save(records);
    return { stored: true, key, verified: verified === true };
  });
}
export async function findExperiences({ scope, project, limit = 10 } = {}) {
  if (typeof scope !== 'string' || !scope.trim() || typeof project !== 'string' || !project.trim()) throw new TypeError('invalid_experience_query');
  if(sqlite)return sqlite.findExperiences({scope,project,limit});
  return serialized(async () => {
    const records = await load();
    return Object.entries(records).filter(([key]) => {
      try { const parts = JSON.parse(key); return parts[0] === 'experience' && parts[1] === scope && parts[2] === project; } catch { return false; }
    }).slice(-Math.max(1, Math.min(50, limit))).map(([id, value]) => ({ id, ...value }));
  });
}


// Contextual recall over persisted experiences; verified results are ranked first,
// but unverified notes are never silently promoted to facts.
const tokens = value => [...new Set(normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
export async function searchExperiences({scope,project,query,limit=20,offset=0,verifiedOnly=false}={}){
 if (![scope,project,query].every(v=>typeof v==='string'&&v.trim()) || query.length>4000)throw new TypeError('invalid_memory_search');
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)throw new TypeError('invalid_memory_pagination');
 if(sqlite)return sqlite.searchExperiences({scope,project,query,limit,offset,verifiedOnly});
 const words=tokens(query);
 return serialized(async()=>{
  const records=await load();
  const matches=[];
  for(const [key,value] of Object.entries(records)){
   let parts;try{parts=JSON.parse(key);}catch{continue;}
   if(!Array.isArray(parts)||parts[0]!=='experience'||parts[1]!==scope||parts[2]!==project)continue;
   if(verifiedOnly&&value?.verified!==true)continue;
   const summary=typeof value?.summary==='string'?value.summary:'';
   const body=new Set(tokens(summary));
   const overlap=words.filter(w=>body.has(w)).length;
   if(!overlap)continue;
   matches.push({id:key,summary,outcome:value.outcome,verified:value.verified===true,source:value.source,taskId:value.taskId,savedAt:value.savedAt,relevance:overlap/words.length});
  }
  matches.sort((a,b)=>b.relevance-a.relevance||Number(b.verified)-Number(a.verified)||String(b.savedAt).localeCompare(String(a.savedAt)));
  return {results:matches.slice(offset,offset+limit),total:matches.length,offset,limit,persistence:'file'};
 });
}
export async function memoryStatistics({scope,project}={}){
 if(typeof scope!=='string'||!scope.trim()||typeof project!=='string'||!project.trim())throw new TypeError('invalid_memory_statistics');
 if(sqlite)return sqlite.memoryStatistics({scope,project});
 return serialized(async()=>{
  const records=await load();
  let experiences=0,verified=0;
  for(const [key,value] of Object.entries(records)){
   let parts;try{parts=JSON.parse(key);}catch{continue;}
   if(Array.isArray(parts)&&parts[0]==='experience'&&parts[1]===scope&&parts[2]===project){
    experiences++;if(value?.verified===true)verified++;
   }
  }
  return {scope,project,experiences,verified,unverified:experiences-verified,persistence:'file'};
 });
}
