import test from 'node:test';
import assert from 'node:assert/strict';
import {platform} from 'node:os';
import {runWindowsReadOnlyCheck,WINDOWS_CHECKS} from '../agents/cyber/windows-native.js';
test('Windows inventory has a fixed read-only command allowlist',()=>{
 assert.deepEqual(WINDOWS_CHECKS,['system','firewall','defender','listeners','sharing']);
});
test('Windows inventory does not execute without approval',async()=>{
 const r=await runWindowsReadOnlyCheck({check:'system'});
 assert.equal(r.executed,false);
 assert.equal(r.status,platform()==='win32'?'approval_required':'windows_required');
});
test('Windows inventory rejects unsupported checks',async()=>{
 const r=await runWindowsReadOnlyCheck({check:'Invoke-Expression',approved:true});
 assert.equal(r.executed,false);
 assert.equal(r.status,platform()==='win32'?'unsupported_check':'windows_required');
});
