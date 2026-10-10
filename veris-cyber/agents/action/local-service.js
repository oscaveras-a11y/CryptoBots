import {readFileSync,constants} from 'node:fs';
import {open,lstat,realpath,opendir,link,unlink} from 'node:fs/promises';
import {isAbsolute,join,relative,sep,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createCodeAuthority} from '../code/authority.js';
import {authorizeCodeTask} from '../code/permissions.js';
const MAX_BYTES=20000;
const TEXT=/\.(?:txt|md|js|mjs|cjs|ts|tsx|jsx|py|html|css|json|sql|ya?ml)$/i;
const PROTECTED=/^(?:\.git|node_modules|\.env(?:\..*)?|id_rsa|id_ed25519|api-token|code-authority\.json.*|.*\.(?:pem|key|p12)|secrets?\.(?:json|ya?ml))$/i;
function safePath(path){
 return typeof path==='string'&&path.length>0&&path.length<=260&&!isAbsolute(path)&&!/[\\:\x00-\x1f]/.test(path)&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p)&&!PROTECTED.test(p)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
}
const inside=(root,path)=>{const rel=relative(root,path);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);};
export function createLocalActionService({config,authorityFile}={}){
 const {projects}=JSON.parse(readFileSync(config,'utf8'));
 if(!projects||typeof projects!=='object'||Array.isArray(projects)||Object.keys(projects).length>20||Object.entries(projects).some(([name,root])=>!name.trim()||typeof root!=='string'||(!isAbsolute(root)||/^[\\\\/]{2}/.test(root))))throw new TypeError('invalid_projects_config');
 const authority=createCodeAuthority({file:authorityFile});
 function authorize({tool,project,permissionId,path,content}={}){
  if(!Object.hasOwn(projects,project))return {allowed:false,reason:'project_not_registered'};
  if(!['list-files','read-file','create-note'].includes(tool))return {allowed:false,reason:'unsupported_action_tool'};
  if(tool!=='list-files'&&(!safePath(path)||!TEXT.test(path)))return {allowed:false,reason:'unsafe_action_path'};
  if(tool==='create-note'&&(!/\.(?:md|txt)$/i.test(path)||typeof content!=='string'||Buffer.byteLength(content)>MAX_BYTES))return {allowed:false,reason:'invalid_note'};
  return authorizeCodeTask(authority.resolve(permissionId),{project,operation:tool==='create-note'?'action-create':'action-read',paths:tool==='list-files'?[]:[path]});
 }
 async function locate(root,path,missing=false){
  let cursor=root;const parts=path.split('/');
  for(let i=0;i<parts.length;i++){
   cursor=join(cursor,parts[i]);
   try{const stat=await lstat(cursor);if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()))throw new Error('unsafe_action_path');}
   catch(error){if(missing&&i===parts.length-1&&error.code==='ENOENT')return cursor;throw error;}
   const actual=await realpath(cursor);if(!inside(root,actual))throw new Error('unsafe_action_path');cursor=actual;
  }
  return cursor;
 }
 async function executeInner({data}={}, {signal}={}){
  const permission=authorize(data);if(!permission.allowed)return {status:'blocked',reason:permission.reason,executed:false};
  const {tool,project,path,content}=data;
  try{
   signal?.throwIfAborted();const root=await realpath(projects[project]);
   if(tool==='list-files'){
    const files=[];let visited=0,truncated=false;
    async function walk(dir){
     const entries=await opendir(dir);
     for await(const entry of entries){
      signal?.throwIfAborted();if(++visited>1000||files.length>=200){truncated=true;return;}
      if(PROTECTED.test(entry.name)||entry.isSymbolicLink())continue;
      const candidate=join(dir,entry.name),actual=await realpath(candidate);if(!inside(root,actual))continue;
      const rel=relative(root,actual).split(sep).join('/');if(!safePath(rel))continue;
      if(entry.isDirectory()){await walk(actual);if(truncated)return;continue;}
      if(!entry.isFile()||!TEXT.test(rel)||!authorize({...data,tool:'read-file',path:rel}).allowed)continue;
      const stat=await lstat(actual);if(stat.isSymbolicLink())continue;files.push({path:rel,bytes:stat.size});
     }
    }
    await walk(root);if(!authorize(data).allowed)throw new Error('task_permission_required');
    // Revocations and narrower path scopes take effect before disclosure.
    if(files.some(f=>!authorize({...data,tool:'read-file',path:f.path}).allowed))throw new Error('task_permission_required');
    return {status:'files_listed',project,files,truncated,executed:true,verified:true};
   }
   const target=await locate(root,path,tool==='create-note');
   signal?.throwIfAborted();if(!authorize(data).allowed)throw new Error('task_permission_required');
   if(tool==='read-file'){
    const file=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
    try{
     const stat=await file.stat();if(!stat.isFile()||stat.size>MAX_BYTES)throw new Error('file_too_large');
     const buffer=Buffer.alloc(MAX_BYTES+1);let bytesRead=0;while(bytesRead<buffer.length){const part=await file.read(buffer,bytesRead,buffer.length-bytesRead,bytesRead);if(!part.bytesRead)break;bytesRead+=part.bytesRead;}if(bytesRead>MAX_BYTES)throw new Error('file_too_large');
     signal?.throwIfAborted();if(!authorize(data).allowed)throw new Error('task_permission_required');
     return {status:'file_read',project,path,content:buffer.subarray(0,bytesRead).toString('utf8'),executed:true,verified:true};
    }finally{await file.close();}
   }
   // Publish a fully written note with an exclusive hard link; never replace.
   const temporary=join(dirname(target),'.jarvis-note-'+randomUUID()+'.tmp');
   try{
    const file=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600);
    try{await file.writeFile(content,'utf8');await file.sync();}finally{await file.close();}
    signal?.throwIfAborted();if(!authorize(data).allowed)throw new Error('task_permission_required');
    await locate(root,path,true);
    await link(temporary,target);
   }finally{try{await unlink(temporary);}catch{}}

   return {status:'note_created',project,path,bytes:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex'),executed:true,verified:true};
  }catch(error){
   const status=error.code==='EEXIST'?'file_exists':signal?.aborted?'action_cancelled':['unsafe_action_path','task_permission_required','file_too_large'].includes(error.message)?error.message:'action_failed';
   return {status,executed:false,verified:false};
  }
 }
 async function execute(request,options){
  const result=await executeInner(request,options);let auditRecorded=false;
  try{const {permissionId,project,tool,path}=request.data;auditRecorded=authority.recordExecution({permissionId,project,tool,path,status:result.status,executed:result.executed===true});}catch{}
  return {...result,auditRecorded};
 }
 return {authorize,execute};
}

