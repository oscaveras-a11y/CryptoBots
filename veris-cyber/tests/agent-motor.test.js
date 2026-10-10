import test from 'node:test';
import assert from 'node:assert/strict';
import {VerisCore} from '../core/src/index.js';
import {connectAgents} from '../core/src/connect-agents.js';
test('motor exposes readiness separately from registration for all twelve agents',()=>{
 const core=connectAgents(new VerisCore());
 assert.equal(core.capabilities.length,12);
 assert.equal(core.capabilities.find(a=>a.name==='vision').ready,false);
 assert.equal(core.capabilities.find(a=>a.name==='mind').ready,true);
 assert.equal(core.capabilities.find(a=>a.name==='mind').modelReady,false);
});
test('motor invokes configured local adapters and keeps tools under host authority',async()=>{
 const core=connectAgents(new VerisCore({mindResponder:async()=>({status:'ok',reply:'Resposta local',model:'fixture'}),visionAnalyzer:async()=>({observations:[{description:'Objeto de teste',imageId:'test'}]}),actionExecutor:async()=>({status:'done',executed:true}),actionAuthorizer:()=>({allowed:false,reason:'denied'})}));
 assert.equal((await core.invokeAgent('mind',{message:'Olá',intent:'conversation'})).result.answer,'Resposta local');
 assert.equal((await core.invokeAgent('vision',{data:{images:[{id:'test',mimeType:'image/png',byteLength:100}]}})).result.status,'observations_ready');
 assert.equal((await core.invokeAgent('action',{instruction:'execute',data:{}})).status,'blocked');
 assert.equal((await core.invokeAgent('code',{data:{}})).status,'blocked');
 await assert.rejects(()=>core.invokeAgent('unknown',{}),/unknown_agent/);
 const job=core.submitAgent('sense',{message:'Olá'});await new Promise(r=>setTimeout(r,20));assert.equal(core.getTask(job.id).result.result.intent,'conversation');
});
test('all twelve native handlers are callable with honest adapter requirements',async()=>{
 const core=connectAgents(new VerisCore({researchRetriever:async()=>[]}));
 const inputs={sense:{message:'Olá'},mind:{message:'Olá',intent:'conversation'},memory:{message:'test'},planner:{message:'test'},research:{message:'test'},vision:{},voice:{},code:{},cyber:{},action:{},guard:{},verify:{}};
 for(const [name,input] of Object.entries(inputs)){
  const response=await core.invokeAgent(name,input);
  assert.ok(['ok','blocked'].includes(response.status),name+': '+JSON.stringify(response));
 }
});
