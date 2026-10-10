import test from 'node:test';
import assert from 'node:assert/strict';
import mind from './index.js';
test('MIND can plan a coding request without granting permission to execute',async()=>{const result=await mind({message:'Corrija um erro no código',intent:'task'});assert.equal(result.status,'planning');assert.equal(result.nextAgent,'planner');assert.equal(result.executed,false);assert.equal(result.verified,false);assert.ok(result.next);});
