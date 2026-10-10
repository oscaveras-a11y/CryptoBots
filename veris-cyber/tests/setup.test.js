import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setupAccess} from '../scripts/setup.js';
test('setup creates and preserves a private credential without returning it',async t=>{const root=await mkdtemp(join(tmpdir(),'jarvis-setup-'));t.after(()=>rm(root,{recursive:true,force:true}));const tokenFile=join(root,'config','api-token');assert.deepEqual(await setupAccess({tokenFile}),{configured:true});const initial=await readFile(tokenFile,'utf8');assert.match(initial,/^[a-f0-9]{64}\n$/);if(process.platform!=='win32')await chmod(tokenFile,0o644);await setupAccess({tokenFile});assert.equal(await readFile(tokenFile,'utf8'),initial);if(process.platform!=='win32')assert.equal((await stat(tokenFile)).mode&0o777,0o600);});
test('setup refuses to overwrite an invalid existing credential',async t=>{const root=await mkdtemp(join(tmpdir(),'jarvis-setup-invalid-'));t.after(()=>rm(root,{recursive:true,force:true}));const tokenFile=join(root,'api-token');await writeFile(tokenFile,'invalid');await assert.rejects(()=>setupAccess({tokenFile}),/invalid_existing_api_token/);assert.equal(await readFile(tokenFile,'utf8'),'invalid');});
