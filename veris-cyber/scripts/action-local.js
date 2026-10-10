// Owner-run native tools; no generated commands and no external connections.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createLocalActionService} from '../agents/action/local-service.js';
import {VerisCore} from '../core/src/index.js';
try{
 const file=process.argv[2];if(!file)throw new Error('request_file_required');
 const source=await readFile(resolve(file),'utf8');if(Buffer.byteLength(source)>30000)throw new Error('request_too_large');
 const {tool,project,permissionId,path,content}=JSON.parse(source);
 const service=createLocalActionService({config:fileURLToPath(new URL('../config/projects.json',import.meta.url)),authorityFile:fileURLToPath(new URL('../config/code-authority.json',import.meta.url))});
 const core=new VerisCore({actionExecutor:service.execute,actionAuthorizer:service.authorize});
 const response=await core.invokeAgent('action',{data:{tool,project,permissionId,path,content}});
 const result=response.result??{status:response.status,reason:response.reason??response.error,executed:false};
 console.log(JSON.stringify(result,null,2));if(result.executed!==true)process.exitCode=1;
}catch{console.error('Confira o projeto, a permissão local e o arquivo JSON da tarefa.');process.exitCode=1;}
