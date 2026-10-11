// Shared SQLite document checkpoints for CODE journals and autonomous workers.
// Each legacy JSON file is imported once; callers keep their existing async API.
import Database from 'better-sqlite3';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {homedir} from 'node:os';
import {join} from 'node:path';
const location=()=>resolve(process.env.VERIS_SQLITE_MEMORY_PATH||join(process.env.LOCALAPPDATA||process.env.XDG_DATA_HOME||join(homedir(),'.local','share'),'VERIS-CYBER','memory.sqlite'));
export function createCheckpointStore({file,initial,validate}={}){
 if(typeof file!=='string'||!file.trim()||typeof validate!=='function')throw new TypeError('invalid_checkpoint_store');
 const databasePath=location();mkdirSync(dirname(databasePath),{recursive:true});
 const db=new Database(databasePath);
 db.pragma('journal_mode = WAL');db.pragma('busy_timeout = 5000');db.pragma('cache_size = -8192');
 db.exec('CREATE TABLE IF NOT EXISTS checkpoints(namespace TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL)');
 const key=resolve(file);
 const select=db.prepare('SELECT payload FROM checkpoints WHERE namespace=?');
 const upsert=db.prepare('INSERT INTO checkpoints(namespace,payload,updated_at) VALUES(?,?,?) ON CONFLICT(namespace) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at');
 const saved=select.get(key);
 if(!saved){
  const original=existsSync(key)?JSON.parse(readFileSync(key,'utf8')):initial;
  if(!validate(original))throw new Error('invalid_legacy_checkpoint');
  upsert.run(key,JSON.stringify(original),new Date().toISOString());
 }
 const read=async()=>JSON.parse(select.get(key).payload);
 const write=async value=>{if(!validate(value))throw new Error('invalid_checkpoint');upsert.run(key,JSON.stringify(value),new Date().toISOString());};
 return {read,write,close:()=>db.close()};
}
