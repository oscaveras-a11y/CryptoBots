import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWindowsAssessment} from '../agents/cyber/windows-assessment.js';
test('Windows assessment requires a named host and explicit authorization',()=>{
 assert.equal(prepareWindowsAssessment({}).status,'computer_required');
 assert.equal(prepareWindowsAssessment({computer:'test-pc'}).status,'authorization_required');
});
test('Windows assessment is a read-only plan and does not claim execution',()=>{
 const r=prepareWindowsAssessment({computer:'test-pc',authorization:{confirmed:true,reference:'owner-approved-test'}});
 assert.equal(r.status,'assessment_ready');
 assert.equal(r.executed,false);
 assert.equal(r.requiresApprovalBeforeExecution,true);
 assert.ok(r.checks.some(x=>x.id==='defender'));
 assert.ok(r.checks.some(x=>x.id==='network'));
});
