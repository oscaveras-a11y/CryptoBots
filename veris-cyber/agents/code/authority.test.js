import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const module = await import('./authority.js').catch(()=>({}));

test('permission authority persists grants and revocation across restarts',async t=>{
  assert.equal(typeof module.createCodeAuthority,'function');
  const dir=await mkdtemp(join(tmpdir(),'jarvis-auth-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'authority.json');
  const authority=module.createCodeAuthority({file});
  const id=authority.grant({actor:'owner',project:'demo',operations:['inspect','propose','stage','rollback'],allowPaths:['src/**'],denyPaths:['src/private.js'],expiresAt:Date.now()+60000});
  const restarted=module.createCodeAuthority({file});
  assert.equal(restarted.resolve(id).project,'demo');
  assert.equal(restarted.resolve(id).confirmed,true);
  assert.equal(restarted.revoke(id,'owner'),true);
  assert.equal(authority.resolve(id),null);
});

test('approval is bound to proposal and operation, single use and expires',async t=>{
  assert.equal(typeof module.createCodeAuthority,'function');
  const dir=await mkdtemp(join(tmpdir(),'jarvis-approval-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  let now=1000;const authority=module.createCodeAuthority({file:join(dir,'auth.json'),clock:()=>now});
  const id=authority.approve({actor:'owner',project:'demo',operation:'stage',proposalId:'a'.repeat(64),branch:'jarvis/change',paths:['src/app.js'],expiresAt:2000});
  const approval=authority.approval(id);
  assert.equal(authority.verify({approval,project:'other',operation:'stage',proposalId:approval.proposalId,paths:approval.paths}),false);
  assert.equal(authority.verify({approval,project:'demo',operation:'stage',proposalId:'b'.repeat(64),paths:approval.paths}),false);
  assert.equal(authority.verify({approval,project:'demo',operation:'stage',proposalId:approval.proposalId,paths:['src/private.js']}),false);
  assert.equal(authority.verify({approval,project:'demo',operation:'stage',proposalId:approval.proposalId,paths:approval.paths}),true);
  assert.equal(authority.verify({approval,project:'demo',operation:'stage',proposalId:approval.proposalId,paths:approval.paths}),false);
  now=3000;assert.equal(authority.approval(id),null);
});

test('authority refuses weak grants and protected branches',async t=>{
  assert.equal(typeof module.createCodeAuthority,'function');
  const dir=await mkdtemp(join(tmpdir(),'jarvis-grant-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const a=module.createCodeAuthority({file:join(dir,'auth.json')});
  assert.throws(()=>a.grant({project:'demo',expiresAt:Date.now()+60000}),/invalid_grant/);
  assert.throws(()=>a.approve({actor:'owner',project:'demo',operation:'stage',proposalId:'a'.repeat(64),branch:'main',paths:['app.js'],expiresAt:Date.now()+60000}),/invalid_approval/);
});
