// Owner-run launcher. Configuration never comes from HTTP or a generated prompt.
import {readFile,stat,open,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,isAbsolute,basename} from 'node:path';
import {spawn} from 'node:child_process';
import {buildModelArguments} from '../src/local-runtime.js';
const configFile=fileURLToPath(new URL('../config/local-model.json',import.meta.url));
const credentialFile=fileURLToPath(new URL('../config/api-token',import.meta.url));
async function main(){
 const config=JSON.parse(await readFile(configFile,'utf8'));
 if(config.endpoint!=='http://127.0.0.1:3210/v1/chat/completions'||config.model!=='jarvis-local')throw new Error('invalid_local_runtime_config');
 const token=(await readFile(credentialFile,'utf8')).trim();if(!/^[a-f0-9]{64}$/.test(token))throw new Error('run_setup_first');
 try{
  const existing=await fetch('http://127.0.0.1:3210/v1/models',{redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(2000)});
  if(existing.ok){const info=await existing.json();if(info.data?.some(m=>m.id==='jarvis-local')){console.log('Modelo local já está disponível.');return;}}
 }catch{}
 if(typeof config.executable!=='string'||!isAbsolute(config.executable)||!['llama-server.exe','llama-server'].includes(basename(config.executable)))throw new Error('local_runtime_executable_required');
 for(const file of [config.executable,config.modelFile])if(!(await stat(file)).isFile())throw new Error('local_runtime_file_required');
 const args=buildModelArguments({modelFile:config.modelFile,credentialFile});
 const logs=fileURLToPath(new URL('../data/model-runtime/',import.meta.url));await mkdir(logs,{recursive:true});
 const stdout=await open(logs+'stdout.log','a',0o600),stderr=await open(logs+'stderr.log','a',0o600);
 try{
  const child=spawn(config.executable,args,{cwd:dirname(config.executable),detached:true,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
 }finally{await stdout.close();await stderr.close();}
 for(let i=0;i<60;i++){
  try{const response=await fetch('http://127.0.0.1:3210/v1/models',{redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(1000)});if(response.ok){const info=await response.json();if(info.data?.some(m=>m.id==='jarvis-local')){console.log('Modelo local disponível em 127.0.0.1:3210. Inicie o JARVIS com npm start.');return;}}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 throw new Error('model_start_not_confirmed_check_local_logs');
}
main().catch(()=>{console.error('Não foi possível confirmar o modelo. Confira config/local-model.json, npm run setup e os logs locais.');process.exitCode=1;});
