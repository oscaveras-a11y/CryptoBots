import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const sqliteAvailable=await import('better-sqlite3').then(()=>true,()=>false);
test('SQLite FTS5 imports legacy JSON, indexes records, isolates projects and reopens', {skip:!sqliteAvailable},async()=>{
 const {createSqliteMemory}=await import('../agents/memory/sqlite-store.js');
 const dir=await mkdtemp(join(tmpdir(),'veris-sqlite-'));
 try{
  const file=join(dir,'memory.sqlite'),legacyPath=join(dir,'memory.json');
  await writeFile(legacyPath,JSON.stringify({[JSON.stringify(['experience','user','project','old-id'])]:{summary:'Motor antigo recuperado',verified:true,outcome:'success'}}));
  let db=createSqliteMemory({file,legacyPath,cacheKb:1024});
  assert.equal(db.searchExperiences({scope:'user',project:'project',query:'motor'}).total,1);
  db.storeExperience({scope:'user',project:'project',summary:'Falha de conexão temporária',verified:false});
  db.storeVerified('Qual versão?','v2',{scope:'user'});
  assert.equal(db.recall('QUAL VERSÃO?',{scope:'user'}).answer,'v2');
  assert.equal(db.searchExperiences({scope:'other',project:'project',query:'conexão'}).total,0);
  assert.equal(db.memoryStatistics({scope:'user',project:'project'}).experiences,2);
  db.close();
  db=createSqliteMemory({file,legacyPath});
  assert.equal(db.searchExperiences({scope:'user',project:'project',query:'motor'}).total,1);
  assert.equal(db.recall('qual versão?',{scope:'user'}).answer,'v2');
  db.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});
