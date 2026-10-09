import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('health and audit authorization validation', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const health = await fetch(base + '/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, 'veris-cyber');
    const rejected = await fetch(base + '/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'example.test', scope: 'test', authorized: false }) });
    assert.equal(rejected.status, 400);
    const accepted = await fetch(base + '/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'example.test', scope: 'demo only', authorized: true }) });
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).active_scan, false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
