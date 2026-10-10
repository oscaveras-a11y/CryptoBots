import {readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createCodeService} from './service.js';
import {createCodeAuthority} from './authority.js';
import {createPatchWorkspace} from './workspace.js';
import {authorizeCodeTask} from './permissions.js';

export function createLocalCodeService({config,authorityFile,workspaceStorage}={}){
  const {projects}=JSON.parse(readFileSync(config,'utf8'));
  if(!projects||typeof projects!=='object'||Array.isArray(projects)||Object.keys(projects).length>20||Object.entries(projects).some(([name,root])=>!name.trim()||typeof root!=='string'||!isAbsolute(root)))throw new TypeError('invalid_projects_config');
  const authority=createCodeAuthority({file:authorityFile});
  const workspace=createPatchWorkspace({storage:workspaceStorage});
  const proposals=new Map();
  const base=createCodeService({trustedProjects:projects,resolveTaskPermission:id=>authority.resolve(id),verifyApproval:args=>authority.verify(args),stageChanges:args=>workspace.stage(args)});
  function clean(){for(const [key,value] of proposals)if(value.expiresAt<=Date.now())proposals.delete(key);while(proposals.size>=100)proposals.delete(proposals.keys().next().value);}
  async function scopedReview(project,reviewReference,permissionId,operation){
    const policy=authority.resolve(permissionId);
    const permission=authorizeCodeTask(policy,{operation,project});
    if(!permission.allowed)return {denied:{status:permission.reason,executed:false}};
    const review=await workspace.describe({project,reviewReference});
    const paths=review.changes.map(c=>c.path);
    const scope=authorizeCodeTask(policy,{operation,project,paths});
    return scope.allowed?{review,paths}:{denied:{status:scope.reason,executed:false}};
  }
  return {
    ...base,
    authorize({operation,project,permissionId,paths=[]}){return authorizeCodeTask(authority.resolve(permissionId),{operation,project,paths});},
    async propose(project,instruction,options,permissionId){
      clean();const result=await base.propose(project,instruction,options,permissionId);
      if(result.status==='proposal_ready')proposals.set(project+':'+result.proposalId,{proposal:structuredClone(result),expiresAt:Date.now()+900000});
      return result;
    },
    async stage(project,proposalId,approvalId,permissionId){
      clean();const stored=typeof proposalId==='string'?proposals.get(project+':'+proposalId):null;
      const approval=typeof approvalId==='string'?authority.approval(approvalId):null;
      if(!approval)return {status:'approval_required',executed:false};
      if(!stored)return {status:'proposal_not_available',executed:false};
      return base.stage(project,stored.proposal,approval,permissionId);
    },
    async describe(project,reviewReference,permissionId){
      const result=await scopedReview(project,reviewReference,permissionId,'describe');return result.denied??result.review;
    },
    async rollback(project,reviewReference,approvalId,permissionId){
      const result=await scopedReview(project,reviewReference,permissionId,'rollback');if(result.denied)return result.denied;
      const approval=typeof approvalId==='string'?authority.approval(approvalId):null;
      if(!approval||!authority.verify({approval,project,operation:'rollback',reviewReference,paths:result.paths}))return {status:'approval_required',executed:false};
      return workspace.rollback({project,reviewReference});
    }
  };
}
