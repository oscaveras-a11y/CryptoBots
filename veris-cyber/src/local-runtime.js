import {isAbsolute} from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
export function loadLocalModelConfig({file,credentialFile,env=process.env}={}){
 const saved=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
 if(!saved&&!env.JARVIS_LOCAL_MODEL_ENDPOINT)return null;
 return {endpoint:env.JARVIS_LOCAL_MODEL_ENDPOINT??saved?.endpoint,model:env.JARVIS_LOCAL_MODEL_NAME??saved?.model??'jarvis-local',apiKey:readFileSync(credentialFile,'utf8').trim()};
}
export function buildModelArguments({modelFile,credentialFile}={}){
 if(typeof modelFile!=='string'||!isAbsolute(modelFile)||!modelFile.endsWith('.gguf')||modelFile.includes('\0'))throw new TypeError('invalid_model_file');
 if(typeof credentialFile!=='string'||!isAbsolute(credentialFile)||credentialFile.includes('\0'))throw new TypeError('invalid_credential_file');
 return ['--model',modelFile,'--host','127.0.0.1','--port','3210','--ctx-size','1024','--threads','2','--threads-batch','2','--batch-size','64','--ubatch-size','64','--parallel','1','--gpu-layers','0','--offline','--no-webui','--no-agent','--cors-origins','http://127.0.0.1:3200','--api-key-file',credentialFile,'--alias','jarvis-local'];
}
