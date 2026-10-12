import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieveCodeContext} from '../agents/code/context-retrieval.js';
import code from '../agents/code/index.js';
const files=[{path:'src/login.js',content:'export function authenticateUser() { return true; }'},{path:'src/map.js',content:'export function drawMap() {}'},{path:'.env',content:'PASSWORD=secret'}];
test('CODE selects relevant context and excludes secrets',()=>{
 const result=retrieveCodeContext({instruction:'fix login authenticateUser',files});
 assert.equal(result.status,'context_ready');
 assert.equal(result.selected[0].path,'src/login.js');
 assert.equal(result.selected.some(x=>x.path==='.env'),false);
});
test('CODE retrieval respects context budget',()=>{
 const result=retrieveCodeContext({instruction:'authenticateUser',files,maxChars:100});
 assert.ok(result.selected.reduce((n,x)=>n+x.content.length,0)<=100);
});
test('CODE agent exposes retrieval operation',async()=>{
 const result=await code({data:{operation:'retrieve_context',topic:'drawMap',files}});
 assert.equal(result.selected[0].path,'src/map.js');
});
test('CODE retrieval rejects invalid input',()=>assert.equal(retrieveCodeContext({instruction:''}).status,'invalid_instruction'));
