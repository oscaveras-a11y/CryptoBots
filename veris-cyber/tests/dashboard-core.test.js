import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('JARVIS dashboard requires authentication and reports actual CORE capabilities', async t => {
  const token = 'a'.repeat(64);
  const server = createServer({token, networkMode:'offline'});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/core/dashboard';
  const denied = await fetch(url);
  assert.notEqual(denied.status, 200);
  const response = await fetch(url,{headers:{Authorization:'Bearer '+token}});
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.service,'JARVIS');
  assert.equal(data.agents.length,12);
  assert.equal(data.features.voiceInput,false);
  assert.equal(data.features.voiceOutput,false);
  assert.equal(data.features.localModel,false);
  assert.equal(data.system.metricsAvailable,false);
  assert.equal(typeof data.queue,'object');
});
