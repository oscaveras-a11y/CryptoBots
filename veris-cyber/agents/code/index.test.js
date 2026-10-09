import test from 'node:test';
import assert from 'node:assert/strict';
import code, { analyzeProject, prepareChanges, applyApprovedProposal } from './index.js';

const files = [{ path: 'src/app.js', content: 'const value = 1;\n// TODO: tests' }];
test('inspection is read-only and returns source locations', () => {
  const result = analyzeProject(files);
  assert.equal(result.executed, false);
  assert.equal(result.findings[0].line, 2);
  assert.equal(result.findings[0].status, 'requires_review');
});
test('rejects traversal and sensitive files', () => {
  assert.throws(() => analyzeProject([{ path: '../secret.js', content: 'x' }]));
  assert.throws(() => analyzeProject([{ path: '.env', content: 'x' }]));
});
test('requires matching file baseline', () => {
  assert.throws(() => prepareChanges(files, [{path:'src/app.js',content:'new',expectedSha256:'wrong'}]));
});
test('staging is denied without explicit approval or adapter', async () => {
  const baseline = analyzeProject(files).files[0].sha256;
  const proposal = prepareChanges(files, [{path:'src/app.js',content:'const value = 2;',expectedSha256:baseline}]);
  assert.equal((await applyApprovedProposal(proposal, null)).status, 'approval_required');
  assert.equal((await applyApprovedProposal(proposal, {confirmed:true,proposalId:proposal.proposalId,project:'example',branch:'feature/change',paths:['src/app.js']} )).status, 'requires_trusted_approval_verifier');
});
test('approved staging delegates to isolated workspace only', async () => {
  const baseline = analyzeProject(files).files[0].sha256;
  const proposal = prepareChanges(files, [{path:'src/app.js',content:'const value = 2;',expectedSha256:baseline}]);
  const result = await applyApprovedProposal(proposal, {confirmed:true,proposalId:proposal.proposalId,project:'example',branch:'feature/change',paths:['src/app.js']}, {verifyApproval: async () => true, stageChanges:async () => ({staged:true,reviewReference:'review-1'})});
  assert.equal(result.status, 'staged_for_review');
});
test('agent refuses unsupported operations', async () => {
  assert.equal((await code({data:{operation:'run-command'}})).executed, false);
});

test('untrusted approval object cannot stage changes', async () => {
  const baseline = analyzeProject(files).files[0].sha256;
  const proposal = prepareChanges(files, [{path:'src/app.js',content:'const value = 3;',expectedSha256:baseline}]);
  let called = false;
  const approval = {confirmed:true,proposalId:proposal.proposalId,project:'example',branch:'feature/change',paths:['src/app.js']};
  const result = await applyApprovedProposal(proposal, approval, {verifyApproval: async () => false, stageChanges: async () => {called = true;return {staged:true};}});
  assert.equal(result.status, 'approval_required');
  assert.equal(called, false);
});
