import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProject } from './project-reader.js';
import { createCodeService } from './service.js';

test('reader excludes secrets, symlinks and dependencies', async t => {
  const root = await mkdtemp(join(tmpdir(), 'code-test-'));
  t.after(() => rm(root, { recursive:true, force:true }));
  await mkdir(join(root,'src'));
  await mkdir(join(root,'node_modules'));
  await writeFile(join(root,'src','app.js'), 'const answer = 42;');
  await writeFile(join(root,'.env'), 'SECRET=private');
  await writeFile(join(root,'node_modules','bad.js'), 'ignored');
  await symlink(join(root,'.env'), join(root,'src','alias.js'));
  const result = await readProject(root);
  assert.deepEqual(result.files.map(x => x.path), ['src/app.js']);
});
test('service is read-only without host adapters', async t => {
  const root = await mkdtemp(join(tmpdir(), 'code-service-'));
  t.after(() => rm(root, { recursive:true, force:true }));
  await writeFile(join(root,'app.js'), '// TODO: review');
  const svc = createCodeService({ trustedProjects: {demo:root} });
  const scan = await svc.inspect('demo');
  assert.equal(scan.findings[0].code, 'unfinished_work');
  await assert.rejects(() => svc.propose('demo','fix'), /native_engine_operation_not_supported/);
  assert.equal((await svc.test('demo','review-1',{project:'demo',operation:'test',reviewReference:'review-1'})).status, 'requires_trusted_test_adapter');
  assert.equal((await svc.review('demo','review-1',{project:'demo',operation:'review',reviewReference:'review-1'})).status, 'requires_github_review_adapter');
  await assert.rejects(() => svc.inspect('other'), /project_not_registered/);
});
test('test adapter is never invoked without trusted authorization', async t => {
  const root = await mkdtemp(join(tmpdir(), 'code-check-'));
  t.after(() => rm(root, { recursive:true, force:true }));
  let called = false;
  const svc = createCodeService({ trustedProjects:{demo:root}, verifyApproval:async () => false, runChecks:async () => {called=true;} });
  const result = await svc.test('demo','review-1',{project:'demo',operation:'test',reviewReference:'review-1'});
  assert.equal(result.status,'approval_required');
  assert.equal(called,false);
});
