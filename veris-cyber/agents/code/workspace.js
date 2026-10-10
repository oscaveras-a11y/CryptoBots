// Review copies only. This adapter never executes code or changes the source project.
import {mkdtemp,mkdir,lstat,realpath,readFile,writeFile,rename,rm,open} from 'node:fs/promises';
import {resolve,relative,join,dirname,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {prepareChanges} from './index.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function safePath(p){
  if(typeof p!=='string'||p.length>260||!p.length||p.includes('\\')||p.includes(':')||p.includes('\0')||isAbsolute(p)||p.split('/').some(x=>!x||x==='.'||x==='..'||/[. ]$/.test(x)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x)))throw new Error('invalid_patch_path');
  return p;
}
async function regularPath(root,p,{missing=false}={}){
  safePath(p);const canonical=await realpath(root);let cursor=canonical;
  const parts=p.split('/');
  for(let i=0;i<parts.length;i++){
    cursor=join(cursor,parts[i]);
    try{const s=await lstat(cursor);if(s.isSymbolicLink()||(i<parts.length-1?!s.isDirectory():!s.isFile()))throw new Error('unsafe_patch_path');}
    catch(e){if(missing&&e.code==='ENOENT')return null;throw e;}
  }
  const actual=await realpath(cursor),rel=relative(canonical,actual);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('unsafe_patch_path');
  return actual;
}
async function readRegular(root,p,maxBytes=300000){
  const file=await regularPath(root,p,{missing:true});if(!file)return null;
  const fd=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{const s=await fd.stat();if(!s.isFile()||s.size>maxBytes)throw new Error('invalid_patch_file');return await fd.readFile('utf8');}finally{await fd.close();}
}
export function createPatchWorkspace({storage}={}){
  if(typeof storage!=='string'||!storage.trim())throw new TypeError('workspace_storage_required');
  storage=resolve(storage);
  async function manifest(project,id){
    if(!UUID.test(id??''))throw new Error('invalid_review_reference');
    const dir=join(storage,id);const stat=await lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('unsafe_workspace');
    // Up to 300k baseline + 6M changed source bytes, each JSON-escaped by up to 6x.
    const m=JSON.parse(await readRegular(dir,'manifest.json',40000000));
    if(m.project!==project)throw new Error('review_project_mismatch');
    for(const c of m.changes)safePath(c.path);
    return {dir,m};
  }
  return {
    async stage({root,project,branch,changes}){
      if(typeof branch!=='string'||!branch.trim()||['main','master'].includes(branch.toLowerCase()))throw new Error('protected_branch');
      await mkdir(storage,{recursive:true,mode:0o700});
      const src=await realpath(root),dest=await realpath(storage),rel=relative(src,dest),reverse=relative(dest,src);
      if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel))||(!reverse.startsWith('..')&&!isAbsolute(reverse)))throw new Error('workspace_overlaps_project');
      if(!Array.isArray(changes)||!changes.length||changes.length>20)throw new Error('invalid_changes');
      const seen=new Set(),before=[],originals=[];
      for(const c of changes){
        safePath(c.path);const key=c.path.toLowerCase();if(seen.has(key))throw new Error('duplicate_patch_path');seen.add(key);
        if(typeof c.content!=='string'||hash(c.content)!==c.afterSha256)throw new Error('patch_hash_mismatch');
        const content=await readRegular(src,c.path);
        if((content===null?null:hash(content))!==c.beforeSha256)throw new Error('stale_file_baseline');
        if(content!==null)before.push({path:c.path,content});originals.push({...c,beforeContent:content});
      }
      // Reuse CODE's secret, extension, duplicate and content size validation.
      const validated=prepareChanges(before,changes.map(c=>({path:c.path,expectedSha256:c.beforeSha256,content:c.content})));
      const temp=await mkdtemp(join(storage,'.pending-')),id=randomUUID();
      try{
        for(const c of originals){const target=join(temp,'files',c.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,c.content,{flag:'wx',mode:0o600});}
        await writeFile(join(temp,'manifest.json'),JSON.stringify({version:1,project,branch,proposalId:validated.proposalId,status:'staged',createdAt:new Date().toISOString(),changes:originals}),{flag:'wx',mode:0o600});
        await rename(temp,join(storage,id));
        return {staged:true,reviewReference:id};
      }catch(e){await rm(temp,{recursive:true,force:true});throw e;}
    },
    async describe({project,reviewReference}){
      const {m}=await manifest(project,reviewReference);
      return {status:m.status,project:m.project,branch:m.branch,proposalId:m.proposalId,reviewReference,changes:m.changes.map(({path,beforeSha256,afterSha256,beforeContent,content})=>({path,beforeSha256,afterSha256,before:beforeContent,after:content})),executed:false};
    },
    async rollback({project,reviewReference}){
      const {dir,m}=await manifest(project,reviewReference);
      const lock=await open(join(dir,'rollback.lock'),'wx',0o600).catch(()=>{throw new Error('workspace_busy');});
      try{
        if(m.status==='rolled_back')return {status:'already_rolled_back',executed:false};
        const files=join(dir,'files');
        // Preflight all paths before mutating any file; recovery tolerates partial prior rollback.
        for(const c of m.changes){const value=await readRegular(files,c.path);const actual=value===null?null:hash(value);if(actual!==c.afterSha256&&actual!==c.beforeSha256)throw new Error('rollback_conflict');}
        for(const c of m.changes){const target=join(files,c.path);if(c.beforeContent===null)await rm(target,{force:true});else await writeFile(target,c.beforeContent,{mode:0o600});}
        m.status='rolled_back';const temp=join(dir,'manifest-'+randomUUID()+'.json');await writeFile(temp,JSON.stringify(m),{flag:'wx',mode:0o600});await rename(temp,join(dir,'manifest.json'));
        return {status:'rolled_back',executed:true,reviewReference};
      }finally{await lock.close();await rm(join(dir,'rollback.lock'),{force:true});}
    }
  };
}
