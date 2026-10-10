// Local owner authority. Never expose grant/approve through an HTTP endpoint.
import {readFileSync,writeFileSync,mkdirSync,renameSync,openSync,closeSync,unlinkSync,lstatSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const operations=new Set(['action-read','action-create','inspect','security-audit','propose','stage','test','review','rollback','describe']);
const text=x=>typeof x==='string' && x.trim().length>0 && x.length<=260;
const list=x=>Array.isArray(x) && x.length<=200 && x.every(text);
const identity=x=>text(x.actor) && text(x.project) && Number.isFinite(x.expiresAt);
const hash=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
export function createCodeAuthority({file,clock=()=>Date.now()}={}) {
  if(!text(file)) throw new TypeError('authority_file_required');
  file=resolve(file);mkdirSync(dirname(file),{recursive:true,mode:0o700});
  function read(){
    try {
      const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2000000)throw new Error('invalid_authority_file');
      const data=JSON.parse(readFileSync(file,'utf8'));
      if(data.version!==1||!data.grants||!data.approvals||!Array.isArray(data.audit))throw new Error('invalid_authority_file');
      return data;
    } catch(e){if(e.code==='ENOENT')return {version:1,grants:{},approvals:{},audit:[]};throw e;}
  }
  function mutate(fn){
    // Concurrent CLI/server updates fail closed rather than lose a revocation.
    const lock=file+'.lock',temp=file+'.'+randomUUID()+'.tmp';
    let fd;try{fd=openSync(lock,'wx',0o600);}catch{throw new Error('authority_busy');}
    try{const data=read();const result=fn(data);data.audit=data.audit.slice(-1000);writeFileSync(temp,JSON.stringify(data),{flag:'wx',mode:0o600});renameSync(temp,file);return result;}
    finally{try{unlinkSync(temp);}catch{}closeSync(fd);unlinkSync(lock);}
  }
  const event=(data,action,id,actor)=>data.audit.push({action,id,actor,at:clock()});
  const active=x=>x && !x.revoked && !x.consumed && clock()<x.expiresAt;
  return {
    recordExecution({permissionId,project,tool,path,status,executed}={}){
      if(![permissionId,project,tool,status].every(text)||(path!==undefined&&!text(path))||typeof executed!=='boolean')throw new TypeError('invalid_execution_event');
      return mutate(data=>{const policy=Object.hasOwn(data.grants,permissionId)?data.grants[permissionId]:null;if(!policy||policy.project!==project)return false;
        data.audit.push({action:'tool_execution',id:permissionId,actor:policy.actor,project,tool,...(path?{path}:{}),status,executed,at:clock()});return true;});
    },
    grant(policy={}){
      if(!identity(policy)||policy.expiresAt<=clock()||policy.expiresAt>clock()+86400000||!list(policy.operations)||!policy.operations.length||policy.operations.some(x=>!operations.has(x))||!list(policy.allowPaths)||!policy.allowPaths.length||!list(policy.denyPaths))throw new TypeError('invalid_grant');
      return mutate(data=>{const id=randomUUID();data.grants[id]={...structuredClone(policy),confirmed:true};event(data,'grant',id,policy.actor);return id;});
    },
    resolve(id){const data=read();const p=Object.hasOwn(data.grants,id)?data.grants[id]:null;return active(p)?structuredClone(p):null;},
    revoke(id,actor){if(!text(actor))throw new TypeError('actor_required');return mutate(data=>{const p=data.grants[id]??data.approvals[id];if(!p)return false;p.revoked=true;event(data,'revoke',id,actor);return true;});},
    approve(value={}){
      const stage=value.operation==='stage';
      if(!identity(value)||value.expiresAt<=clock()||value.expiresAt>clock()+3600000||!['stage','rollback','test','review'].includes(value.operation)||!list(value.paths)||!value.paths.length||
        (stage && (!hash(value.proposalId)||!text(value.branch)||['main','master'].includes(value.branch.toLowerCase())))||(!stage && !text(value.reviewReference)))throw new TypeError('invalid_approval');
      return mutate(data=>{const id=randomUUID();data.approvals[id]={...structuredClone(value),id,confirmed:true};event(data,'approve',id,value.actor);return id;});
    },
    approval(id){const data=read();const p=Object.hasOwn(data.approvals,id)?data.approvals[id]:null;return active(p)?structuredClone(p):null;},
    verify({approval,project,operation='stage',proposalId,reviewReference,paths=[]}={}){
      return mutate(data=>{const p=approval?.id && Object.hasOwn(data.approvals,approval.id)?data.approvals[approval.id]:null;
        if(!active(p)||p.project!==project||p.operation!==operation||!list(paths)||paths.some(x=>!p.paths.includes(x))||
          (operation==='stage' && (p.proposalId!==proposalId||p.branch!==approval.branch))||
          (operation!=='stage' && p.reviewReference!==reviewReference))return false;
        p.consumed=true;event(data,'consume',p.id,p.actor);return true;});
    }
  };
}
