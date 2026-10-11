import test from 'node:test';
import assert from 'node:assert/strict';
import {createInteractionMemory} from '../agents/memory/interactions.js';
import code from '../agents/code/index.js';

test('interaction search prioritizes relevant previous turns',()=>{
 const memory=createInteractionMemory();
 const scope='test-relevance',sessionId='relevance-case';
 memory.clear(scope,sessionId);
 memory.append({scope,sessionId,role:'user',content:'Projeto motor de navegação offline'});
 memory.append({scope,sessionId,role:'user',content:'Outro assunto diferente'});
 const results=memory.search(scope,sessionId,'navegação offline');
 assert.equal(results[0].content,'Projeto motor de navegação offline');
 memory.clear(scope,sessionId);memory.close();
});

test('CODE defensive review reports risky code without executing it',async()=>{
 const report=await code({instruction:'Review',data:{operation:'defensive_review',files:[{path:'app.js',content:'eval(userInput);'}]}});
 assert.equal(report.status,'review_ready');
 assert.equal(report.executed,false);
 assert.ok(report.findings.some(item=>item.code==='dynamic_code_execution'));
});
