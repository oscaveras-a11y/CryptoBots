import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.js';
test('local panel loads without exposing credentials and keeps API protected',async t=>{
  const token='a'.repeat(64),server=createServer({token});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const html=await page.text();assert.match(html,/J\.A\.R\.V\.I\.S\./);assert.equal(html.includes(token),false);
  assert.equal((await fetch(base+'/dashboard.js')).status,200);assert.equal((await fetch(base+'/dashboard.css')).status,200);
  assert.equal((await fetch(base+'/api/core/agents')).status,401);
  assert.equal((await fetch(base+'/../config/api-token')).status,404);
});
