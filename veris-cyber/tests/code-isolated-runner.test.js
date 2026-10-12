import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import code from '../agents/code/index.js';
import { runIsolatedNodeTests } from '../agents/code/isolated-runner.js';

test('CODE runner requires host permission',async()=>{
 const r=await code({data:{operation:'run_tests',files:[]}});
 assert.equal(r.status,'execution_permission_required');
});
test('runner rejects traversal and missing test files',async()=>{
 await assert.rejects(()=>runIsolatedNodeTests({files:[{path:'../escape.test.js',content:''}]}),/invalid_runner_file/);
 const r=await runIsolatedNodeTests({files:[{path:'app.js',content:'export const x=1;'}]});
 assert.equal(r.status,'requires_test_files');
});
test('runner launches constrained Docker without shell',async()=>{
 let called=false;
 const result=await runIsolatedNodeTests({files:[{path:'app.test.mjs',content:"import test from 'node:test'; test('ok',()=>{});"}]},{
  spawnProcess:(command,args,options)=>{
   called=true;
   assert.equal(command,'docker');
   assert.equal(options.shell,false);
   assert.ok(args.includes('none'));
   assert.ok(args.includes('--read-only'));
   assert.ok(args.includes('--cap-drop'));
   const child=new EventEmitter();
   child.stdout=new EventEmitter();
   child.stderr=new EventEmitter();
   child.kill=()=>{};
   queueMicrotask(()=>child.emit('close',0,null));
   return child;
  }
 });
 assert.equal(called,true);
 assert.equal(result.status,'passed');
});
