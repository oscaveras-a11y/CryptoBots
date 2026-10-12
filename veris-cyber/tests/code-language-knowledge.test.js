import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';
import { languageLessons } from '../agents/code/language-knowledge.js';
test('CODE has twelve additional practical programming modules',()=>{
 assert.equal(languageLessons.length,12);
 assert.equal(new Set(languageLessons.map(x=>x.id)).size,12);
});
test('CODE retrieves Node and TypeScript guidance',async()=>{
 for(const [topic,id] of [['node express','node-runtime'],['typescript tipagem','typescript-types'],['python asyncio','python-runtime'],['sqlite postgres','sql-design'],['csrf xss','web-security'],['browser dom','browser-javascript'],['css responsive','css-layout'],['pwa serviceworker','pwa-service-worker'],['node:test mock','testing-node'],['rest endpoint','rest-api'],['github actions','git-actions'],['crypto criptografia','cryptography']]){
  const r=await code({data:{operation:'knowledge',topic,limit:5}});
  assert.ok(r.lessons.some(x=>x.id===id),topic);
 }
});
