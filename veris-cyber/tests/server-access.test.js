import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.js';
const token='a'.repeat(64);
async function withServer(t){const server=createServer({token});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}
test('refuses configuration without a strong API credential',()=>{assert.throws(()=>createServer({token:''}),/api_token_required/);assert.throws(()=>createServer({token:'short'}),/api_token_required/);});
test('private routes require a token even with authorized=true',async t=>{const base=await withServer(t);assert.equal((await fetch(base+'/health')).status,200);assert.equal((await fetch(base+'/api/core/agents')).status,401);assert.equal((await fetch(base+'/api/core/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Execute algo',scope:'lab',authorized:true})})).status,401);assert.equal((await fetch(base+'/api/core/agents',{headers:{Authorization:'Bearer wrong'}})).status,401);assert.equal((await fetch(base+'/api/core/agents',{headers:{Authorization:'Bearer '+token}})).status,200);});
test('rejects browser requests and rebinding hosts outside local origin',async t=>{const base=await withServer(t);assert.equal((await fetch(base+'/api/core/agents',{headers:{Authorization:'Bearer '+token,Origin:'https://untrusted.example'}})).status,403);const status=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/core/agents',{headers:{Authorization:'Bearer '+token,Host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(status,403);});
