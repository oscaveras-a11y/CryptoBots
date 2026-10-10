import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.js';
test('authenticated motor API returns capability state and runs queued agent input',async()=>{
 const token='a'.repeat(64),server=createServer({token,networkMode:'offline'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(base+'/api/core/capabilities')).status,401);
  const caps=await fetch(base+'/api/core/capabilities',{headers});assert.equal(caps.status,200);assert.equal((await caps.json()).agents.length,12);
  const response=await fetch(base+'/api/core/agents/sense/tasks',{method:'POST',headers,body:JSON.stringify({message:'Olá'})});assert.equal(response.status,202);const job=await response.json();
  await new Promise(r=>setTimeout(r,30));const read=await fetch(base+'/api/core/tasks/'+job.id,{headers});assert.equal((await read.json()).result.result.intent,'conversation');
  assert.equal((await fetch(base+'/api/core/agents/invalid/tasks',{method:'POST',headers,body:'{}'})).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
