import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalActionService} from '../agents/action/local-service.js';
import {createCodeAuthority} from '../agents/code/authority.js';
import {VerisCore} from '../core/src/index.js';

test('ACTION creates a scoped note, reads it and never overwrites existing files',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'jarvis-action-'));try{
  const root=join(temp,'project');await mkdir(root);await mkdir(join(root,'notes'));
  const config=join(temp,'projects.json'),authorityFile=join(temp,'authority.json');await writeFile(config,JSON.stringify({projects:{lab:root}}));
  const authority=createCodeAuthority({file:authorityFile});
  const permissionId=authority.grant({actor:'owner',project:'lab',expiresAt:Date.now()+60000,operations:['action-read','action-create'],allowPaths:['notes/**'],denyPaths:[]});
  const service=createLocalActionService({config,authorityFile});const core=new VerisCore({actionExecutor:service.execute,actionAuthorizer:service.authorize});
  const data={project:'lab',permissionId,tool:'create-note',path:'notes/test.md',content:'Minha nota'};
  assert.equal((await core.invokeAgent('action',{data:{...data,permissionId:'fake'}})).status,'blocked');
  const result=await core.invokeAgent('action',{data});assert.equal(result.result.status,'note_created');assert.equal(await readFile(join(root,'notes/test.md'),'utf8'),'Minha nota');
  assert.equal((await core.invokeAgent('action',{data})).result.status,'file_exists');
  const read=await core.invokeAgent('action',{data:{...data,tool:'read-file'}});assert.equal(read.result.content,'Minha nota');
  assert.equal(read.result.auditRecorded,true);
  const audit=JSON.parse(await readFile(authorityFile,'utf8')).audit;
  assert.ok(audit.some(e=>e.action==='tool_execution'&&e.tool==='create-note'&&e.status==='note_created'));
  assert.ok(!JSON.stringify(audit).includes('Minha nota'));
  assert.equal((await core.invokeAgent('action',{data:{...data,path:'../outside.md'}})).status,'blocked');
  const list=await core.invokeAgent('action',{data:{project:'lab',permissionId,tool:'list-files'}});assert.equal(list.result.files[0].path,'notes/test.md');
  authority.revoke(permissionId,'owner');assert.equal((await core.invokeAgent('action',{data})).status,'blocked');
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('ACTION rejects secret files, unknown tools, large notes and Windows aliases',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'jarvis-action-'));try{
  const config=join(temp,'projects.json'),authorityFile=join(temp,'authority.json');await writeFile(config,JSON.stringify({projects:{lab:temp}}));
  const authority=createCodeAuthority({file:authorityFile});const permissionId=authority.grant({actor:'owner',project:'lab',expiresAt:Date.now()+60000,operations:['action-read','action-create'],allowPaths:['notes/**','.env'],denyPaths:[]});
  const service=createLocalActionService({config,authorityFile});
  for(const path of ['.env','notes/CON.md','notes/file.md:stream','notes/file.md.','.git/config'])assert.equal(service.authorize({tool:'read-file',project:'lab',permissionId,path}).allowed,false);
  assert.equal(service.authorize({tool:'shell',project:'lab',permissionId}).allowed,false);
  assert.equal(service.authorize({tool:'create-note',project:'lab',permissionId,path:'notes/big.md',content:'x'.repeat(20001)}).allowed,false);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('ACTION rejects network and device project roots',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'jarvis-action-'));try{
  const config=join(temp,'projects.json');
  for(const root of ['\\\\server\\share\\project','//server/share/project','\\\\?\\C:\\project']){
   await writeFile(config,JSON.stringify({projects:{lab:root}}));
   assert.throws(()=>createLocalActionService({config,authorityFile:join(temp,'authority.json')}),/invalid_projects_config/);
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
