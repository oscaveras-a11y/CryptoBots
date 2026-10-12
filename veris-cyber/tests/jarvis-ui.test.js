import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.js';

test('JARVIS holographic UI loads locally while preserving legacy tools',async t=>{
 const server=createServer({token:'b'.repeat(64),networkMode:'offline'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 for(const [path,needle] of [['/','JARVIS <em>CONTROL'],['/jarvis.js','requestAnimationFrame'],['/jarvis.css','.stage'],['/legacy','Conectar ao seu assistente']]){
  const response=await fetch(base+path);
  assert.equal(response.status,200,path);
  assert.match(await response.text(),new RegExp(needle),path);
 }
 const denied=await fetch(base+'/api/core/dashboard');
 assert.notEqual(denied.status,200);
});
