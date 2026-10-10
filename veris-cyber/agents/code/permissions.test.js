import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCodeTask } from './permissions.js';
const policy = {confirmed:true,project:'demo',operations:['inspect','propose'],allowPaths:['src/**'],denyPaths:['src/secrets.js'],expiresAt:Date.now()+60000};
test('denies by default, by operation, and by explicit excluded path', () => {
 assert.equal(authorizeCodeTask(null,{operation:'inspect',project:'demo'}).allowed,false);
 assert.equal(authorizeCodeTask(policy,{operation:'stage',project:'demo'}).allowed,false);
 assert.equal(authorizeCodeTask(policy,{operation:'propose',project:'demo',paths:['src/secrets.js']}).allowed,false);
 assert.equal(authorizeCodeTask(policy,{operation:'propose',project:'demo',paths:['src/app.js']}).allowed,true);
 assert.equal(authorizeCodeTask(policy,{operation:'propose',project:'other',paths:['src/app.js']}).allowed,false);
});
test('expired grants are denied', () => {
 assert.equal(authorizeCodeTask({...policy,expiresAt:Date.now()-1},{operation:'inspect',project:'demo'}).allowed,false);
});
