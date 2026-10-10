import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.js';
const module=await import('../src/local-model.js').catch(()=>({}));
test('local model adapter rejects remote destinations and sends text only',async()=>{
  assert.equal(typeof module.createLocalModel,'function');
  assert.throws(()=>module.createLocalModel({endpoint:'https://external.example/v1/chat/completions'}),/local_endpoint_required/);
  assert.throws(()=>module.createLocalModel({endpoint:'http://127.0.0.1.evil.test/v1/chat/completions'}),/local_endpoint_required/);
  let request;
  const model=module.createLocalModel({endpoint:'http://127.0.0.1:8080/v1/chat/completions',fetchImpl:async(url,init)=>{request={url,init,body:JSON.parse(init.body)};return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:'Resposta local em português.'}}]})};}});
  const result=await model({message:'Explique uma variável'});
  assert.equal(result.reply,'Resposta local em português.');assert.equal(result.execution,'text_only');
  assert.equal(request.init.redirect,'error');assert.equal(request.body.tools,undefined);assert.equal(request.body.messages.length,2);
});
test('offline server never falls back to a remote provider',async t=>{
  const token='a'.repeat(64),server=createServer({token,networkMode:'offline'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  const privacy=await(await fetch(base+'/api/privacy',{headers:{Authorization:'Bearer '+token}})).json();assert.equal(privacy.networkMode,'offline');
  const reply=await(await fetch(base+'/api/assistant/chat',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:'Olá',networkMode:'online'})})).json();assert.equal(reply.status,'local_model_not_configured');
});
test('local model includes host-supplied credential without returning it',async()=>{
 const key='f'.repeat(64);let authorization;
 const respond=module.createLocalModel({endpoint:'http://127.0.0.1:3210/v1/chat/completions',apiKey:key,fetchImpl:async(_,options)=>{authorization=options.headers.Authorization;return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:'Olá'}}]})};}});
 const result=await respond({message:'Olá'});assert.equal(authorization,'Bearer '+key);assert.ok(!JSON.stringify(result).includes(key));
});
