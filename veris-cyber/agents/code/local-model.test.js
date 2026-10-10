import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLocalCodeModel } from './local-model.js';
import { createCodeService } from './service.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('local model generates a validated proposal without writing source', async t => {
  const root = await mkdtemp(join(tmpdir(), 'code-model-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'app.js'),'const n = 1;');
  const baseline = createHash('sha256').update('const n = 1;').digest('hex');
  let request;
  const fetchImpl = async (url, options) => {
    request = JSON.parse(options.body);
    assert.equal(url,'http://127.0.0.1:11434/api/chat');
    return {ok:true,text:async () => JSON.stringify({message:{content:JSON.stringify({changes:[{path:'app.js',expectedSha256:baseline,content:'const n = 2;'}]})}})};
  };
  const svc = createCodeService({trustedProjects:{demo:root},generateChanges:createLocalCodeModel({fetchImpl})});
  const proposal = await svc.propose('demo','Change n to 2');
  assert.equal(proposal.status,'proposal_ready');
  assert.equal(proposal.executed,false);
  assert.equal(proposal.changes[0].afterSha256,createHash('sha256').update('const n = 2;').digest('hex'));
  assert.equal(request.messages[1].content.includes(baseline),true);
});
test('rejects remote model endpoints', () => {
  assert.throws(() => createLocalCodeModel({endpoint:'https://example.com/api/chat'}),/local_ollama_endpoint_required/);
});
test('rejects malformed model responses', async () => {
  const generate = createLocalCodeModel({fetchImpl:async () => ({ok:true,text:async () => JSON.stringify({message:{content:'not-json'}})})});
  await assert.rejects(() => generate({project:'demo',instruction:'fix',files:[]}),SyntaxError);
});
