import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const IMAGE='node:22-alpine';
const MAX_FILES=40, MAX_BYTES=200_000;
function validate(files) {
 if(!Array.isArray(files)||files.length>MAX_FILES)throw new TypeError('invalid_runner_files');
 let size=0;
 const seen=new Set();
 for(const f of files){
  if(!f||typeof f.path!=='string'||typeof f.content!=='string'||!f.path||
   f.path.startsWith('/')||f.path.includes('\\')||f.path.split('/').some(x=>!x||x==='.'||x==='..')||
   !/^[a-zA-Z0-9_./-]+$/.test(f.path)||!f.path.endsWith('.js')&&!f.path.endsWith('.mjs')&&!f.path.endsWith('.json')||
   seen.has(f.path))throw new TypeError('invalid_runner_file');
  seen.add(f.path);
  size+=Buffer.byteLength(f.content);
  if(size>MAX_BYTES)throw new TypeError('runner_input_too_large');
 }
}
export async function runIsolatedNodeTests({files=[],timeoutMs=12000}={},deps={}) {
 validate(files);
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)throw new TypeError('invalid_runner_timeout');
 if(!files.some(f=>/\.test\.(?:m?js)$/.test(f.path)))return {status:'requires_test_files',executed:false};
 const spawnProcess=deps.spawnProcess??spawn;
 const root=await mkdtemp(join(tmpdir(),'veris-code-'));
 try {
  for(const file of files){
   const destination=resolve(root,file.path);
   if(!destination.startsWith(root+sep))throw new TypeError('invalid_runner_path');
   await mkdir(resolve(destination,'..'),{recursive:true});
   await writeFile(destination,file.content,{mode:0o600});
  }
  const args=['run','--rm','--network','none','--read-only','--cap-drop','ALL',
   '--security-opt','no-new-privileges','--pids-limit','64','--memory','256m','--cpus','1',
   '--user','10001:10001','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
   '--mount',`type=bind,source=${root},target=/work,readonly`,
   '--workdir','/work',IMAGE,'node','--test'];
  return await new Promise((done)=>{
   let output='',settled=false;
   const child=spawnProcess('docker',args,{stdio:['ignore','pipe','pipe'],shell:false});
   const finish=(result)=>{if(!settled){settled=true;clearTimeout(timer);done(result);}};
   const collect=(chunk)=>{output=(output+String(chunk)).slice(-12000);};
   child.stdout?.on('data',collect);
   child.stderr?.on('data',collect);
   child.on('error',e=>finish({status:'runner_unavailable',executed:false,error:e.code??'spawn_failed'}));
   child.on('close',(code,signal)=>finish({status:code===0?'passed':'failed',executed:true,exitCode:code,signal,output}));
   const timer=setTimeout(()=>{child.kill('SIGKILL');finish({status:'timeout',executed:true,output});},timeoutMs);
  });
 } finally {await rm(root,{recursive:true,force:true});}
}
