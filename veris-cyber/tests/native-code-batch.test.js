import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeCodeEngine} from '../agents/code/native-engine.js';
const engine=createNativeCodeEngine();
const files=[{path:'src/a.js',content:'const a = 1;\nconst b = 2;\n'},{path:'src/b.js',content:'export const ok = false;\n'}];
const sha=s=>createHash('sha256').update(s).digest('hex');
test('CODE changes several files with baselines',async()=>{
 const changes=await engine({instruction:'update',files,options:{operation:'replace-many',replacements:[
  {path:'src/a.js',from:'a = 1',to:'a = 3'},
  {path:'src/a.js',from:'b = 2',to:'b = 4'},
  {path:'src/b.js',from:'ok = false',to:'ok = true'}
 ]}});
 assert.equal(changes.length,2);
 assert.match(changes[0].content,/a = 3/);
 assert.match(changes[0].content,/b = 4/);
 assert.equal(changes[1].expectedSha256,sha(files[1].content));
});
test('CODE refuses ambiguous replacements',async()=>{
 await assert.rejects(engine({instruction:'update',files,options:{operation:'replace-many',replacements:[{path:'src/a.js',from:'const',to:'let'}]}}),/unique_match/);
});
test('CODE rejects missing files and invalid batches',async()=>{
 await assert.rejects(engine({instruction:'update',files,options:{operation:'replace-many',replacements:[{path:'src/missing.js',from:'x',to:'y'}]}}),/target_not_found/);
 await assert.rejects(engine({instruction:'update',files,options:{operation:'replace-many',replacements:[]}}),/invalid_replacements/);
});
