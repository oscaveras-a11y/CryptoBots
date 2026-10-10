import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareChanges} from './index.js';
import {createHash} from 'node:crypto';
const module=await import('./workspace.js').catch(()=>({}));
const hash=s=>createHash('sha256').update(s).digest('hex');
async function fixture(t){assert.equal(typeof module.createPatchWorkspace,'function');const dir=await mkdtemp(join(tmpdir(),'jarvis-patch-'));t.after(()=>rm(dir,{recursive:true,force:true}));const root=join(dir,'project'),storage=join(dir,'workspaces');await mkdir(root);await mkdir(join(root,'src'));await writeFile(join(root,'src/app.js'),'const answer=1;');return {root,storage,adapter:module.createPatchWorkspace({storage}),changes:prepareChanges([{path:'src/app.js',content:'const answer=1;'}],[{path:'src/app.js',expectedSha256:hash('const answer=1;'),content:'const answer=2;'}]).changes};}

test('stage creates review copy and rollback leaves original untouched',async t=>{
  const {root,storage,adapter,changes}=await fixture(t);
  const staged=await adapter.stage({root,project:'demo',branch:'jarvis/fix',changes});
  assert.equal(staged.staged,true);
  assert.equal(await readFile(join(root,'src/app.js'),'utf8'),'const answer=1;');
  const copy=join(storage,staged.reviewReference,'files','src/app.js');
  assert.equal(await readFile(copy,'utf8'),'const answer=2;');
  const reviewed=await adapter.describe({project:'demo',reviewReference:staged.reviewReference});
  assert.equal(reviewed.changes[0].afterSha256,hash('const answer=2;'));
  assert.equal((await adapter.rollback({project:'demo',reviewReference:staged.reviewReference})).status,'rolled_back');
  assert.equal(await readFile(copy,'utf8'),'const answer=1;');
  assert.equal((await adapter.rollback({project:'demo',reviewReference:staged.reviewReference})).status,'already_rolled_back');
});

test('stage rejects stale baseline and leaves no published workspace',async t=>{
  const {root,storage,adapter,changes}=await fixture(t);
  await writeFile(join(root,'src/app.js'),'changed externally');
  await assert.rejects(()=>adapter.stage({root,project:'demo',branch:'jarvis/fix',changes}),/stale_file_baseline/);
  assert.deepEqual(await readdir(storage),[]);
});

test('workspace rejects traversal, bad hashes and protected branches',async t=>{
  const {root,adapter,changes}=await fixture(t);
  await assert.rejects(()=>adapter.stage({root,project:'demo',branch:'main',changes}),/protected_branch/);
  await assert.rejects(()=>adapter.stage({root,project:'demo',branch:'jarvis/fix',changes:[{...changes[0],path:'../escape.js'}]}),/invalid_patch_path/);
  await assert.rejects(()=>adapter.stage({root,project:'demo',branch:'jarvis/fix',changes:[{...changes[0],afterSha256:'0'.repeat(64)}]}),/patch_hash_mismatch/);
  await assert.rejects(()=>adapter.describe({project:'demo',reviewReference:'../escape'}),/invalid_review_reference/);
});

test('rollback refuses external edits and project mismatches',async t=>{
  const {root,storage,adapter,changes}=await fixture(t);const staged=await adapter.stage({root,project:'demo',branch:'jarvis/fix',changes});
  await assert.rejects(()=>adapter.describe({project:'other',reviewReference:staged.reviewReference}),/review_project_mismatch/);
  await writeFile(join(storage,staged.reviewReference,'files/src/app.js'),'external edit');
  await assert.rejects(()=>adapter.rollback({project:'demo',reviewReference:staged.reviewReference}),/rollback_conflict/);
  assert.equal(await readFile(join(storage,staged.reviewReference,'files/src/app.js'),'utf8'),'external edit');
});

test('large supported patches remain reviewable and reversible',async t=>{
  const {root,adapter}=await fixture(t);const before='x'.repeat(160000),after=before+'\n';
  await writeFile(join(root,'src/app.js'),before);
  const changes=prepareChanges([{path:'src/app.js',content:before}],[{path:'src/app.js',expectedSha256:hash(before),content:after}]).changes;
  const staged=await adapter.stage({root,project:'demo',branch:'jarvis/fix',changes});
  assert.equal((await adapter.describe({project:'demo',reviewReference:staged.reviewReference})).changes[0].before.length,160000);
  assert.equal((await adapter.rollback({project:'demo',reviewReference:staged.reviewReference})).status,'rolled_back');
});
