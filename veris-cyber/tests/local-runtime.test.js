import test from 'node:test';
import assert from 'node:assert/strict';
import {buildModelArguments,loadLocalModelConfig} from '../src/local-runtime.js';
import {resolve} from 'node:path';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
test('portable conversation runtime binds loopback, stays offline and has no tools',()=>{
 const args=buildModelArguments({modelFile:resolve('model.gguf'),credentialFile:resolve('api-token')});
 for(const flag of ['--offline','--no-agent','--no-webui','--api-key-file'])assert.ok(args.includes(flag));
 assert.equal(args[args.indexOf('--host')+1],'127.0.0.1');assert.equal(args[args.indexOf('--parallel')+1],'1');assert.equal(args[args.indexOf('--ctx-size')+1],'1024');
 assert.throws(()=>buildModelArguments({modelFile:'https://external/model.gguf',credentialFile:resolve('key')}),/invalid_model_file/);
});
test('model authentication matches the launcher file even when API token is overridden',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'jarvis-model-config-'));
 try{
  const file=resolve(root,'model.json'),credentialFile=resolve(root,'api-token');
  writeFileSync(file,JSON.stringify({endpoint:'http://127.0.0.1:3210/v1/chat/completions',model:'jarvis-local'}));writeFileSync(credentialFile,'f'.repeat(64));
  assert.equal(loadLocalModelConfig({file,credentialFile,env:{CYBER_API_TOKEN:'a'.repeat(64)}}).apiKey,'f'.repeat(64));
 }finally{rmSync(root,{recursive:true,force:true});}
});
