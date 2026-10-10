import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from '../src/server.js';
import {createCodeAuthority} from '../agents/code/authority.js';
test('API ACTION executes native tools through CORE only with local project permission',async()=>{
 const root=await mkdtemp(join(tmpdir(),'jarvis-action-api-'));let server;
 try{
  const project=join(root,'project');await mkdir(project);await mkdir(join(project,'notes'));
  const config=join(root,'projects.json'),authorityFile=join(root,'authority.json');await writeFile(config,JSON.stringify({projects:{lab:project}}));
  const authority=createCodeAuthority({file:authorityFile});const permissionId=authority.grant({actor:'owner',project:'lab',expiresAt:Date.now()+60000,operations:['action-create','action-read'],allowPaths:['notes/**'],denyPaths:[]});
  const token='a'.repeat(64);server=createServer({token,networkMode:'offline',codeConfig:{config,authorityFile,workspaceStorage:join(root,'workspaces')}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/action',{method:'POST',body:'{}'})).status,401);
  const payload={tool:'create-note',project:'lab',permissionId,path:'notes/api.md',content:'Nota pela API'};
  const result=await(await fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify(payload)})).json();assert.equal(result.status,'note_created');
  assert.equal(await readFile(join(project,'notes/api.md'),'utf8'),'Nota pela API');
  const task=await(await fetch(base+'/api/core/run',{method:'POST',headers,body:JSON.stringify({message:'Crie uma nota',authorized:true,scope:'meu laboratório local',data:{...payload,path:'notes/core.md',requestedAgent:'action'}})})).json();assert.equal(task.status,'completed');assert.equal(task.action.status,'note_created');
  const caps=await(await fetch(base+'/api/core/capabilities',{headers})).json();assert.equal(caps.agents.find(a=>a.name==='action').ready,true);
 }finally{if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
