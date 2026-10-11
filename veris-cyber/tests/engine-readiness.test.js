import test from 'node:test';
import assert from 'node:assert/strict';
import {ENGINE_NAMES,auditEngineReadiness,classifyTaskFailure} from '../core/src/engine-readiness.js';
test('all twelve engines report honest readiness',()=>{
 const report=auditEngineReadiness();
 assert.equal(report.engines.length,12);
 assert.deepEqual(report.engines.map(x=>x.name),ENGINE_NAMES);
 assert.equal(report.fullyIntegrated,false);
 assert.equal(report.engines.find(x=>x.name==='voice').status,'adapter_required');
 assert.equal(report.engines.find(x=>x.name==='sense').status,'base_available');
 assert.equal(report.engines.every(x=>x.autonomous===false),true);
});
test('authorization never retries automatically',()=>{
 assert.equal(classifyTaskFailure('permission_denied').automaticRetry,false);
 assert.equal(classifyTaskFailure('network_timeout').automaticRetry,true);
 assert.equal(classifyTaskFailure('invalid_test').category,'investigation_required');
});
