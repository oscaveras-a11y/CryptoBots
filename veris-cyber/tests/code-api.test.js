import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../src/server.js';
import {createCodeAuthority} from '../agents/code/authority.js';
const token='a'.repeat(64);
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'jarvis-api-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const root=join(dir,'project');await mkdir(root);await writeFile(join(root,'app.js'),'const n=1;');
  const config=join(dir,'projects.json');await writeFile(config,JSON.stringify({projects:{demo:root}}));
  const authorityFile=join(dir,'authority.json'),workspaceStorage=join(dir,'workspaces');
  const authority=createCodeAuthority({file:authorityFile});
  const permissionId=authority.grant({actor:'owner',project:'demo',operations:['inspect','propose','stage','describe','rollback','test'],allowPaths:['app.js'],denyPaths:[],expiresAt:Date.now()+60000});
  const server=createServer({token,codeConfig:{config,authorityFile,workspaceStorage}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const post=async(input,route='/api/code')=>{const r=await fetch('http://127.0.0.1:'+server.address().port+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input)});return {http:r.status,...await r.json()};};
  return {post,authority,permissionId,root,workspaceStorage};
}

test('CODE API uses CORE with persistent owner authorization and isolated rollback',async t=>{
  const {post,authority,permissionId,root,workspaceStorage}=await fixture(t);
  const inspection=await post({operation:'inspect',project:'demo',permissionId});assert.equal(inspection.http,200);assert.equal(inspection.status,'analyzed');
  const proposed=await post({operation:'propose',project:'demo',permissionId,instruction:'Trocar literal',options:{operation:'replace-literal',path:'app.js',from:'n=1',to:'n=2'}});
  assert.equal(proposed.status,'proposal_ready');
  assert.equal((await post({operation:'stage',project:'demo',permissionId,proposalId:proposed.proposalId,approval:{confirmed:true,project:'demo',branch:'jarvis/fix',paths:['app.js'],proposalId:proposed.proposalId}})).status,'approval_required');
  const approvalId=authority.approve({actor:'owner',project:'demo',operation:'stage',branch:'jarvis/fix',paths:['app.js'],proposalId:proposed.proposalId,expiresAt:Date.now()+60000});
  const staged=await post({operation:'stage',project:'demo',permissionId,proposalId:proposed.proposalId,approvalId});assert.equal(staged.status,'staged_for_review');
  assert.equal(await readFile(join(root,'app.js'),'utf8'),'const n=1;');
  assert.equal(await readFile(join(workspaceStorage,staged.reviewReference,'files/app.js'),'utf8'),'const n=2;');
  assert.equal((await post({operation:'describe',project:'demo',permissionId,reviewReference:staged.reviewReference})).changes[0].after,'const n=2;');
  const rollbackId=authority.approve({actor:'owner',project:'demo',operation:'rollback',paths:['app.js'],reviewReference:staged.reviewReference,expiresAt:Date.now()+60000});
  assert.equal((await post({operation:'rollback',project:'demo',permissionId,reviewReference:staged.reviewReference,approvalId:rollbackId})).status,'rolled_back');
  assert.equal(await readFile(join(workspaceStorage,staged.reviewReference,'files/app.js'),'utf8'),'const n=1;');
  authority.revoke(permissionId,'owner');
  assert.equal((await post({operation:'inspect',project:'demo',permissionId})).status,'task_permission_required');
});

test('CODE API refuses body grants and shell execution without sandbox',async t=>{
  const {post,permissionId}=await fixture(t);
  assert.equal((await post({operation:'inspect',project:'demo',authorized:true,authorization:{confirmed:true}})).status,'task_permission_required');
  assert.equal((await post({operation:'test',project:'demo',permissionId,reviewReference:'anything',command:'node malicious.js'})).status,'requires_trusted_test_adapter');
});

test('main CORE coordinates GUARD PLANNER CODE and exposes proposal awaiting approval',async t=>{
  const {post,permissionId,authority}=await fixture(t);
  const request={message:'Corrija o codigo do programa',scope:'demo',authorized:true,data:{requestedAgent:'code',operation:'propose',project:'demo',permissionId,options:{operation:'replace-literal',path:'app.js',from:'n=1',to:'n=2'}}};
  const task=await post(request,'/api/core/run');
  assert.equal(task.status,'awaiting_approval');
  assert.equal(task.proposal.status,'proposal_ready');
  for(const agent of ['sense','memory','guard','planner','code'])assert.ok(task.trace.some(x=>x.agent===agent));
  assert.equal(task.executed,false);assert.equal(task.verified,false);
  authority.revoke(permissionId,'owner');
  const blocked=await post(request,'/api/core/run');assert.equal(blocked.status,'blocked');assert.equal(blocked.trace.some(x=>x.agent==='code'),false);
});
