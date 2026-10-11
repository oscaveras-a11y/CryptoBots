import Database from 'better-sqlite3';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const norm=s=>s.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
const valid=s=>typeof s==='string'&&s.trim()&&s.length<=200;
const tokens=s=>[...new Set(norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}]{3,}/gu)??[])];
export function createSqliteMemory({file=process.env.VERIS_SQLITE_MEMORY_PATH||join(process.env.LOCALAPPDATA||process.env.XDG_DATA_HOME||join(homedir(),'.local','share'),'VERIS-CYBER','memory.sqlite'),legacyPath=process.env.VERIS_MEMORY_PATH||new URL('../../data/memory.json',import.meta.url).pathname,cacheKb=8192}={}){
 if(typeof file!=='string'||!file.trim()||!Number.isInteger(cacheKb)||cacheKb<256||cacheKb>65536)throw new TypeError('invalid_memory_config');
 const path=resolve(file);mkdirSync(dirname(path),{recursive:true});
 const db=new Database(path);
 db.pragma('journal_mode = WAL');db.pragma('busy_timeout = 5000');db.pragma('cache_size = -'+cacheKb);
 db.exec('CREATE TABLE IF NOT EXISTS facts(scope TEXT NOT NULL,question TEXT NOT NULL,answer TEXT NOT NULL,source TEXT,verified INTEGER NOT NULL,saved_at TEXT NOT NULL,PRIMARY KEY(scope,question));');
 db.exec('CREATE TABLE IF NOT EXISTS experiences(id TEXT PRIMARY KEY,scope TEXT NOT NULL,project TEXT NOT NULL,summary TEXT NOT NULL,outcome TEXT NOT NULL,verified INTEGER NOT NULL,source TEXT,task_id TEXT,saved_at TEXT NOT NULL);');
 db.exec('CREATE INDEX IF NOT EXISTS experiences_project ON experiences(scope,project,saved_at);');
 db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS experience_search USING fts5(summary,content='experiences',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2');");
 db.exec('CREATE TRIGGER IF NOT EXISTS exp_insert AFTER INSERT ON experiences BEGIN INSERT INTO experience_search(rowid,summary) VALUES(new.rowid,new.summary); END;');
 db.exec("CREATE TRIGGER IF NOT EXISTS exp_delete AFTER DELETE ON experiences BEGIN INSERT INTO experience_search(experience_search,rowid,summary) VALUES('delete',old.rowid,old.summary); END;");
 db.exec('CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);');
 const fact=db.prepare('INSERT INTO facts(scope,question,answer,source,verified,saved_at) VALUES(?,?,?,?,?,?) ON CONFLICT(scope,question) DO UPDATE SET answer=excluded.answer,source=excluded.source,verified=excluded.verified,saved_at=excluded.saved_at');
 const exp=db.prepare('INSERT OR IGNORE INTO experiences(id,scope,project,summary,outcome,verified,source,task_id,saved_at) VALUES(?,?,?,?,?,?,?,?,?)');
 const legacy=resolve(legacyPath);
 if(!db.prepare("SELECT 1 FROM metadata WHERE key='legacy_migrated'").get()){
  const records=existsSync(legacy)?JSON.parse(readFileSync(legacy,'utf8')):{};
  if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('invalid_legacy_memory');
  db.transaction(()=>{
   for(const [key,value] of Object.entries(records)){
    let parts;try{parts=JSON.parse(key);}catch{continue;}
    if(!Array.isArray(parts)||!value||typeof value!=='object')continue;
    if(parts[0]==='experience'&&parts.length===4&&typeof value.summary==='string')exp.run(parts[3],parts[1],parts[2],value.summary,value.outcome??'unknown',value.verified===true?1:0,value.source??'legacy',value.taskId??null,value.savedAt??new Date().toISOString());
    else if(parts.length===2&&typeof value.answer==='string')fact.run(parts[0],parts[1],value.answer,value.source??'legacy',value.verified===true?1:0,value.savedAt??new Date().toISOString());
   }
   db.prepare("INSERT INTO metadata(key,value) VALUES('legacy_migrated',?)").run(new Date().toISOString());
  })();
 }
 return {
  storeVerified(question,answer,{source='verified',scope='default'}={}){
   if(!valid(scope)||typeof question!=='string'||!question.trim()||question.length>4000||typeof answer!=='string'||!answer.trim()||answer.length>8000)throw new TypeError('invalid_memory');
   fact.run(scope,norm(question),answer.trim(),source,1,new Date().toISOString());return {stored:true,persistence:'sqlite',scope};
  },
  recall(question,{scope='default'}={}){
   if(!valid(scope)||typeof question!=='string'||!question.trim()||question.length>4000)throw new TypeError('invalid_memory_query');
   const x=db.prepare('SELECT * FROM facts WHERE scope=? AND question=?').get(scope,norm(question));
   return {verified:x?.verified===1,answer:x?.verified===1?x.answer:null,source:x?.source??null,savedAt:x?.saved_at??null,persistence:'sqlite'};
  },
  storeExperience({scope,project,summary,outcome='unknown',verified=false,source='agent',taskId=null}={}){
   if(!valid(scope)||!valid(project)||typeof summary!=='string'||!summary.trim()||summary.length>4000||!['success','failure','unknown'].includes(outcome))throw new TypeError('invalid_experience');
   const id=randomUUID();exp.run(id,scope,project,summary.trim(),outcome,verified===true?1:0,source,taskId,new Date().toISOString());return {stored:true,key:id,verified:verified===true};
  },
  findExperiences({scope,project,limit=10}={}){
   if(!valid(scope)||!valid(project)||!Number.isInteger(limit)||limit<1||limit>50)throw new TypeError('invalid_experience_query');
   return db.prepare('SELECT id,summary,outcome,verified,source,task_id AS taskId,saved_at AS savedAt FROM experiences WHERE scope=? AND project=? ORDER BY saved_at DESC,rowid DESC LIMIT ?').all(scope,project,limit).map(x=>({...x,verified:x.verified===1}));
  },
  searchExperiences({scope,project,query,limit=20,offset=0,verifiedOnly=false}={}){
   if(!valid(scope)||!valid(project)||typeof query!=='string'||!query.trim()||query.length>4000||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)throw new TypeError('invalid_memory_search');
   const match=tokens(query).map(w=>'"'+w+'"').join(' OR ');
   if(!match)return {results:[],total:0,offset,limit,persistence:'sqlite'};
   const where='FROM experience_search JOIN experiences e ON e.rowid=experience_search.rowid WHERE experience_search MATCH ? AND e.scope=? AND e.project=?'+(verifiedOnly?' AND e.verified=1':'');
   const args=[match,scope,project];
   const total=db.prepare('SELECT count(*) AS n '+where).get(...args).n;
   const rows=db.prepare('SELECT e.id,e.summary,e.outcome,e.verified,e.source,e.task_id AS taskId,e.saved_at AS savedAt,bm25(experience_search) AS rank '+where+' ORDER BY rank ASC,e.verified DESC,e.saved_at DESC LIMIT ? OFFSET ?').all(...args,limit,offset);
   return {results:rows.map(({rank,...x})=>({...x,verified:x.verified===1,relevance:-rank})),total,offset,limit,persistence:'sqlite'};
  },
  memoryStatistics({scope,project}={}){
   if(!valid(scope)||!valid(project))throw new TypeError('invalid_memory_statistics');
   const x=db.prepare('SELECT count(*) AS experiences,coalesce(sum(verified),0) AS verified FROM experiences WHERE scope=? AND project=?').get(scope,project);
   return {scope,project,experiences:x.experiences,verified:x.verified,unverified:x.experiences-x.verified,persistence:'sqlite'};
  },
  checkpoint(){return db.pragma('wal_checkpoint(PASSIVE)');},
  close(){db.close();}
 };
}
