import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.js';
import {TaskQueue} from '../core/src/task-queue.js';
test('main engine exposes queued tasks and real results through authenticated API',async t=>{
  const token='a'.repeat(64),server=createServer({token});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;
  const result=await fetch(base+'/api/core/tasks',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:'O que é VERIS CIBER?',mode:'informational'})});
  assert.equal(result.status,202);const job=await result.json();
  let status;const deadline=Date.now()+5000;
  do{status=await(await fetch(base+'/api/core/tasks/'+job.id,{headers:{Authorization:'Bearer '+token}})).json();if(status.status==='completed')break;await new Promise(r=>setTimeout(r,10));}while(Date.now()<deadline);
  assert.equal(status.status,'completed');assert.equal(status.result.status,'answered');
  assert.equal((await fetch(base+'/api/core/tasks/'+job.id)).status,401);
});
test('queue evicts completed metadata within configured retention',async()=>{
  const queue=new TaskQueue({maxCompleted:2});const ids=[];
  for(let i=0;i<4;i++){ids.push(queue.submit(()=>i).id);await new Promise(r=>setImmediate(r));}
  assert.equal(queue.get(ids[0]),null);assert.equal(queue.get(ids[1]),null);assert.equal(queue.get(ids[3]).result,3);
});
