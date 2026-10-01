'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.join(__dirname,'..');
const key='test-key-with-more-than-32-characters-123';
function run(env) {
  return spawnSync(process.execPath,['-e',"require('./legacy-server'); console.log('BOOT_OK')"],{
    cwd:root,encoding:'utf8',env:{...process.env,VERIS_API_KEY:key,...env}
  });
}
const normal=run({NODE_ENV:'production',VERIS_ENABLE_TEST_KNOWLEDGE:'false'});
assert.equal(normal.status,0,normal.stderr);
assert.match(normal.stdout,/BOOT_OK/);
const unsafe=run({NODE_ENV:'production',VERIS_ENABLE_TEST_KNOWLEDGE:'true'});
assert.notEqual(unsafe.status,0);
assert.match(unsafe.stderr,/Base experimental proibida em produção/);
console.log('Configuração de produção: bloqueio da base experimental OK');

