// CODE pipeline: only host-owned adapters may inspect a project, generate proposals or run checks.
// Nothing in this module writes files, executes commands or talks to GitHub.
import { analyzeProject, prepareChanges, applyApprovedProposal } from './index.js';
import { readProject } from './project-reader.js';
import { createNativeCodeEngine } from './native-engine.js';
import { auditSource } from './security.js';
import { authorizeCodeTask } from './permissions.js';
export function createCodeService({ trustedProjects = {}, generateChanges = createNativeCodeEngine(), verifyApproval = null, stageChanges = null, runChecks = null, createReview = null, resolveTaskPermission = null } = {}) {
  const projects = new Map(Object.entries(trustedProjects));
  const select = name => {
    if (typeof name !== 'string' || !projects.has(name)) throw new Error('project_not_registered');
    return projects.get(name);
  };
  async function requireScope(taskId, request) {
    if (typeof resolveTaskPermission !== 'function' || typeof taskId !== 'string' || !taskId) return {allowed:false,reason:'task_permission_required'};
    const policy = await resolveTaskPermission(taskId);
    return authorizeCodeTask(policy,request);
  }
  return {
    async inspect(project, taskId) {
      const permission = await requireScope(taskId,{operation:'inspect',project,paths:[]});
      if (!permission.allowed) return {status:permission.reason,executed:false};
      const { files, truncated, totalBytes } = await readProject(select(project));
      return { ...analyzeProject(files), project, truncated, totalBytes };
    },
    async securityAudit(project, taskId) {
      const permission = await requireScope(taskId,{operation:'security-audit',project,paths:[]});
      if (!permission.allowed) return {status:permission.reason,executed:false};
      const { files, truncated } = await readProject(select(project));
      return { ...auditSource(files), project, truncated };
    },
    async propose(project, instruction, options = {}, taskId) {
      const permission = await requireScope(taskId,{operation:'propose',project,paths:[]});
      if (!permission.allowed) return {status:permission.reason,executed:false};
      if (typeof generateChanges !== 'function') return { status: 'requires_code_model_adapter', executed: false };
      if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > 4000) throw new TypeError('invalid_instruction');
      const { files, truncated } = await readProject(select(project));
      if (truncated) return { status: 'project_context_incomplete', executed: false };
      const changes = await generateChanges({ project, instruction, files: files.map(f => ({ ...f })), options });
      if (!changes.length) return { status: 'no_changes_needed', executed: false, project };
      const changePermission = await requireScope(taskId,{operation:'propose',project,paths:changes.map(c=>c.path)});
      if (!changePermission.allowed) return {status:changePermission.reason,executed:false};
      const proposal = prepareChanges(files, changes);
      return { ...proposal, project };
    },
    async stage(project, proposal, approval, taskId) {
      const permission = await requireScope(taskId,{operation:'stage',project,paths:proposal?.changes?.map(c=>c.path) ?? []});
      if (!permission.allowed) return {status:permission.reason,executed:false};
      select(project);
      if (approval?.project !== project) return { status: 'approval_required', executed: false };
      return applyApprovedProposal(proposal, approval, {
        verifyApproval: typeof verifyApproval === 'function' ? args => verifyApproval({ ...args, project }) : undefined,
        stageChanges: typeof stageChanges === 'function' ? args => stageChanges({ ...args, root: select(project) }) : undefined
      });
    },
    async test(project, reviewReference, approval, taskId) {
      const permission = await requireScope(taskId,{operation:'test',project,paths:[]});
      if (!permission.allowed) return {status:permission.reason,executed:false};
      select(project);
      if (typeof runChecks !== 'function' || typeof verifyApproval !== 'function') return { status: 'requires_trusted_test_adapter', executed: false };
      if (typeof reviewReference !== 'string' || !reviewReference.trim() || approval?.project !== project || approval?.operation !== 'test' || approval?.reviewReference !== reviewReference) return { status: 'approval_required', executed: false };
      if (await verifyApproval({ approval, project, operation: 'test', reviewReference }) !== true) return { status: 'approval_required', executed: false };
      const result = await runChecks({ project, reviewReference, root: select(project) });
      return { status: 'checks_reported', result, verified: false };
    },
    async review(project, reviewReference, approval, taskId) {
      const permission = await requireScope(taskId,{operation:'review',project,paths:[]});
      if (!permission.allowed) return {status:permission.reason,executed:false};
      select(project);
      if (typeof createReview !== 'function' || typeof verifyApproval !== 'function') return { status: 'requires_github_review_adapter', executed: false };
      if (typeof reviewReference !== 'string' || !reviewReference.trim() || approval?.project !== project || approval?.operation !== 'review' || approval?.reviewReference !== reviewReference) return { status: 'approval_required', executed: false };
      if (await verifyApproval({ approval, project, operation: 'review', reviewReference }) !== true) return { status: 'approval_required', executed: false };
      return { status: 'review_requested', result: await createReview({ project, reviewReference }), merged: false };
    }
  };
}
