import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('MEMORY stores and retrieves relevant project experiences across calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veris-memory-'));
 const original=process.env.VERIS_SQLITE_MEMORY_PATH;
 try{
  process.env.VERIS_SQLITE_MEMORY_PATH=join(dir,'memory.sqlite');
  const {storeExperience,searchExperiences,memoryStatistics}=await import('../agents/memory/index.js');
  await storeExperience({scope:'user-a',project:'jarvis',summary:'SQLite database migration failed',outcome:'failure',verified:false});
  await storeExperience({scope:'user-a',project:'jarvis',summary:'SQLite database migration fixed with transaction',outcome:'success',verified:true});
  await storeExperience({scope:'user-b',project:'jarvis',summary:'SQLite database migration secret',verified:true});
  const matches=await searchExperiences({scope:'user-a',project:'jarvis',query:'SQLite migration',limit:1});
  assert.equal(matches.total,2);assert.equal(matches.results.length,1);
  assert.equal(matches.results[0].verified,true);
  const verified=await searchExperiences({scope:'user-a',project:'jarvis',query:'SQLite migration',verifiedOnly:true});
  assert.equal(verified.total,1);
  const stats=await memoryStatistics({scope:'user-a',project:'jarvis'});
  assert.deepEqual([stats.experiences,stats.verified,stats.unverified],[2,1,1]);
  assert.equal((await searchExperiences({scope:'user-a',project:'other',query:'SQLite'})).total,0);
 }finally{
  if(original===undefined)delete process.env.VERIS_SQLITE_MEMORY_PATH;else process.env.VERIS_SQLITE_MEMORY_PATH=original;
  await rm(dir,{recursive:true,force:true});
 }
});
