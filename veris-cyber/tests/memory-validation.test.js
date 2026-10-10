import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('memory rejects invalid scopes, source and query limits',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'jarvis-memory-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const script=`
   const {default:memory,storeVerified,storeExperience,findExperiences}=await import('./agents/memory/index.js');
   const assert=(await import('node:assert/strict')).default;
   await assert.rejects(()=>storeVerified('Q','A',{scope:' ',source:'verified'}),/invalid_scope_or_source/);
   await assert.rejects(()=>storeVerified('Q','A',{source:''}),/invalid_scope_or_source/);
   await assert.rejects(()=>memory({message:'Q',data:{memoryScope:44}}),/invalid_scope/);
   await assert.rejects(()=>memory({message:'Q',data:[]}),/invalid_memory_data/);
   await assert.rejects(()=>storeExperience({scope:'x',project:'p',summary:'ok',source:''}),/invalid_experience/);
   await assert.rejects(()=>findExperiences({scope:'x',project:'p',limit:0}),/invalid_experience_query/);
   await assert.rejects(()=>findExperiences({scope:'x',project:'p',limit:51}),/invalid_experience_query/);
   await storeVerified('Q','A',{scope:'x'});
   assert.equal((await memory({message:'Q',data:{memoryScope:'x'}})).answer,'A');
   assert.equal((await memory({message:'Q',data:{memoryScope:'y'}})).answer,null);
   await storeExperience({scope:'x',project:'p',summary:'test',verified:true});
   assert.equal((await findExperiences({scope:'x',project:'p',limit:1})).length,1);
 `;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,VERIS_MEMORY_PATH:join(dir,'memory.json')},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
