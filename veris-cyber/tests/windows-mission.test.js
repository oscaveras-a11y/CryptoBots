import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowsMission} from '../agents/cyber/windows-mission.js';
const args={computer:'lab-windows',authorization:{confirmed:true,reference:'owner-approval'}};
test('Windows mission selects network-only checks and reporting',()=>{
 const result=createWindowsMission({...args,mode:'network'});
 assert.equal(result.status,'assessment_ready');
 assert.equal(result.executed,false);
 assert.ok(result.checks.some(x=>x.id==='network'));
 assert.ok(result.checks.every(x=>['network','review'].includes(x.phase)));
});
test('Windows mission enforces authorization and valid mode',()=>{
 assert.equal(createWindowsMission({computer:'lab-windows'}).status,'authorization_required');
 assert.equal(createWindowsMission({...args,mode:'invalid'}).status,'invalid_mode');
});
