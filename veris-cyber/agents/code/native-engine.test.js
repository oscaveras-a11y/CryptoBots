import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeCodeEngine } from './native-engine.js';
import { createCodeService } from './service.js';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('native engine replaces only unique literal and never writes to disk', async t => {
 const root = await mkdtemp(join(tmpdir(),'jarvis-native-'));
 t.after(() => rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'app.js'),'const value = 1;');
 const service = createCodeService({trustedProjects:{demo:root},resolveTaskPermission:async () => ({confirmed:true,project:'demo',operations:['inspect','propose','stage','test','review','security-audit'],allowPaths:['app.js','src/**'],denyPaths:[],expiresAt:Date.now()+60000})});
 const result = await service.propose('demo','Update constant',{operation:'replace-literal',path:'app.js',from:'value = 1',to:'value = 2'},'task');
 assert.equal(result.status,'proposal_ready');
 assert.equal(result.changes[0].content,'const value = 2;');
 assert.equal(await readFile(join(root,'app.js'),'utf8'),'const value = 1;');
});
test('native engine fails closed for unsupported instructions', async () => {
 const engine = createNativeCodeEngine();
 await assert.rejects(() => engine({instruction:'create an AI',files:[]}),/not_supported/);
});
test('native engine refuses ambiguous replacement', async () => {
 const engine = createNativeCodeEngine();
 await assert.rejects(() => engine({instruction:'x',files:[{path:'a.js',content:'a a'}],options:{operation:'replace-literal',path:'a.js',from:'a',to:'b'}}),/unique_match/);
});
