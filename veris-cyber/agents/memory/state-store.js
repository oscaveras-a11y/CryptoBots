import Database from 'better-sqlite3';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir} from 'node:os';
const base=process.env.VERIS_DATA_HOME||join(process.env.LOCALAPPDATA||process.env.XDG_DATA_HOME||join(homedir(),'.local','share'),'VERIS-CYBER');
export function createStateStore({namespace,file}={}){
 if(typeof namespace!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(namespace))throw new TypeError('invalid_state_namespace');
 const dbPath=resolve(process.env.VERIS_SQLITE_MEMORY_PATH||join(base,'memory.sqlite'));
 mkdirSync(dirname(dbPath),{recursive:true});
 const db=new Database(dbPath);
 db.pragma('journal_mode = WAL');db.pragma('busy_timeout = 5000');db.pragma('cache_size = -8192');
 db.exec('CREATE TABLE IF NOT EXISTS state_documents(namespace TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at TEXT NOT NULL)');
 const get=db.prepare('SELECT body FROM state_documents WHERE namespace=?');
 const put=db.prepare('INSERT INTO state_documents(namespace,body,updated_at) VALUES(?,?,?) ON CONFLICT(namespace) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at');
 if(!get.get(namespace)&&file&&existsSync(file)){
  const raw=readFileSync(file,'utf8');
  const parsed=JSON.parse(raw); // Refuse corrupt migration; preserve original file.
  const migrated=namespace.startsWith('journal-')&&Array.isArray(parsed)?{version:1,tasks:parsed}:parsed;
  put.run(namespace,JSON.stringify(migrated),new Date().toISOString());
 }
 return {
  read(fallback){const row=get.get(namespace);return row?JSON.parse(row.body):structuredClone(fallback);},
  write(value){put.run(namespace,JSON.stringify(value),new Date().toISOString());},
  update(fallback,change){
   if(typeof change!=='function')throw new TypeError('invalid_state_update');
   return db.transaction(()=>{
    const row=get.get(namespace);
    const state=row?JSON.parse(row.body):structuredClone(fallback);
    const result=change(state);
    if(result&&typeof result.then==='function')throw new TypeError('async_state_update_not_supported');
    put.run(namespace,JSON.stringify(state),new Date().toISOString());
    return structuredClone(result);
   }).immediate();
  },
  close(){db.close();}
 };
}
