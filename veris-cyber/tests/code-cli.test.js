import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCodeAuthority} from '../agents/code/authority.js';
const module=await import('../scripts/code-access.js').catch(()=>({}));
test('owner CLI emits grants and approvals from explicit local files',async t=>{
  assert.equal(typeof module.runCodeAccess,'function');
  const dir=await mkdtemp(join(tmpdir(),'jarvis-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'authority.json'),input=join(dir,'grant.json');
  await writeFile(input,JSON.stringify({actor:'owner',project:'demo',operations:['inspect'],allowPaths:['app.js'],denyPaths:[],expiresAt:Date.now()+60000}));
  const result=await module.runCodeAccess(['grant',input],{file});assert.equal(typeof result.permissionId,'string');
  const a=createCodeAuthority({file});assert.equal(a.resolve(result.permissionId).project,'demo');
  assert.equal((await module.runCodeAccess(['revoke',result.permissionId,'owner'],{file})).revoked,true);
  assert.equal(a.resolve(result.permissionId),null);
  await assert.rejects(()=>module.runCodeAccess(['execute','node bad.js'],{file}),/usage/);
});
