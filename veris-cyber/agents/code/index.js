// CODE: project inspection, evidence-backed findings, proposals and explicitly gated changes.
// No filesystem, shell, network or GitHub write capability is granted by default.
import { createHash } from 'node:crypto';
import { planBlackBoxAssessment } from '../cyber/blackbox.js';
import { evaluateMissionStep } from '../cyber/mission-policy.js';
import { verifyCodeChange } from './verification.js';
import { getCodeKnowledge } from './knowledge.js';
import { engineeringBrief } from './engineering.js';
import { developCode } from './development.js';
import { runDevelopmentCycle } from './cycle.js';
import { findCodeExamples } from './examples.js';
import { summarizeExperience } from './experience.js';
import { runIsolatedNodeTests } from './isolated-runner.js';
import { checkNodeProposal } from './check-node-proposal.js';
import { generateCodeChanges } from './generator.js';
import { mapArchitecture, rankSolutions, diagnoseFailures, planRefactor } from './intelligence.js';
import { extname, posix } from 'node:path';

const MAX_FILES = 200, MAX_BYTES = 300_000;
const SECRET = /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|p12)|secrets?\.(?:json|ya?ml))$/i;
const SUPPORTED = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.html','.css','.json','.sql','.md','.yml','.yaml']);
const hash = value => createHash('sha256').update(value).digest('hex');
function safePath(path) {
  if (typeof path !== 'string' || !path || path.length > 260 || path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  const parts = path.split('/');
  return parts.every(p => p && p !== '.' && p !== '..') && posix.normalize(path) === path && !SECRET.test(path);
}
function sanitizeFiles(files) {
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new TypeError('invalid_project_files');
  let bytes = 0;
  const seen = new Set();
  return files.map(file => {
    if (!file || !safePath(file.path) || typeof file.content !== 'string' || !SUPPORTED.has(extname(file.path).toLowerCase())) throw new TypeError('invalid_project_file');
    if (seen.has(file.path)) throw new TypeError('duplicate_project_path');
    seen.add(file.path);
    bytes += Buffer.byteLength(file.content);
    if (bytes > MAX_BYTES) throw new TypeError('project_too_large');
    return { path: file.path, content: file.content, sha256: hash(file.content) };
  });
}
function inspect(files) {
  const findings = [];
  for (const f of files) {
    const lines = f.content.split(/\r?\n/);
    lines.forEach((line, i) => {
      const rules = [
        [/\beval\s*\(/, 'dynamic_code_execution', 'high'],
        [/\b(?:exec|execSync)\s*\(/, 'shell_execution_review', 'high'],
        [/\b(?:password|apiKey|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/, 'possible_embedded_credential', 'high'],
        [/\bTODO\b|\bFIXME\b/, 'unfinished_work', 'low'],
        [/\b(?:innerHTML|outerHTML)\s*=\s*[^'"`]/, 'dynamic_html_injection_review', 'medium'],
        [/\b(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*False)\b/, 'tls_verification_disabled', 'high'],
        [/\b(?:Math\.random\(\)|random\.random\(\))/, 'weak_randomness_review', 'medium'],
        [/\b(?:debug\s*:\s*true|DEBUG\s*=\s*True)\b/, 'debug_mode_enabled', 'medium']
      ];
      for (const [regex, code, severity] of rules) if (regex.test(line)) findings.push({ path: f.path, line: i + 1, code, severity, status: 'requires_review' });
    });
  }
  return findings.slice(0, 100);
}
export function analyzeProject(files) {
  const entries = sanitizeFiles(files);
  return { status: 'analyzed', executed: false, files: entries.map(({path,sha256}) => ({path,sha256})), findings: inspect(entries), limitations: ['heuristic_checks_only', 'no_runtime_tests', 'no_model_review'] };
}
export function prepareChanges(files, changes) {
  const entries = sanitizeFiles(files), current = new Map(entries.map(f => [f.path, f]));
  if (!Array.isArray(changes) || !changes.length || changes.length > 20) throw new TypeError('invalid_changes');
  const paths = new Set();
  const proposal = changes.map(c => {
    if (!c || !safePath(c.path) || paths.has(c.path) || typeof c.content !== 'string' || Buffer.byteLength(c.content) > MAX_BYTES || !SUPPORTED.has(extname(c.path).toLowerCase())) throw new TypeError('invalid_change');
    paths.add(c.path);
    const before = current.get(c.path);
    if (!before && c.expectedSha256 !== null) throw new TypeError('new_file_requires_null_baseline');
    if (before && c.expectedSha256 !== before.sha256) throw new TypeError('stale_file_baseline');
    return { path: c.path, beforeSha256: before?.sha256 ?? null, afterSha256: hash(c.content), content: c.content };
  });
  return { status: 'proposal_ready', proposalId: hash(JSON.stringify(proposal.map(({path,beforeSha256,afterSha256}) => ({path,beforeSha256,afterSha256})))), changes: proposal, executed: false };
}
export async function applyApprovedProposal(proposal, approval, adapters = {}) {
  if (proposal?.status !== 'proposal_ready' || !Array.isArray(proposal.changes)) throw new TypeError('invalid_proposal');
  if (!approval || approval.confirmed !== true || approval.proposalId !== proposal.proposalId || typeof approval.project !== 'string' || !approval.project.trim() || approval.branch === 'main' || approval.branch === 'master' || typeof approval.branch !== 'string' || !approval.branch.trim() || !Array.isArray(approval.paths)) return { status: 'approval_required', executed: false };
  if (proposal.changes.some(c => !approval.paths.includes(c.path))) return { status: 'out_of_scope', executed: false };
  // A user-supplied approval object is not sufficient: CORE must independently verify authorization.
  if (typeof adapters.verifyApproval !== 'function') return { status: 'requires_trusted_approval_verifier', executed: false };
  const trusted = await adapters.verifyApproval({ approval, proposalId: proposal.proposalId, paths: proposal.changes.map(c => c.path) });
  if (trusted !== true) return { status: 'approval_required', executed: false };
  if (typeof adapters.stageChanges !== 'function') return { status: 'requires_isolated_workspace_adapter', executed: false };
  // The adapter must enforce sandboxing, branch protection, baseline SHA checks and atomicity.
  const result = await adapters.stageChanges({ project: approval.project, branch: approval.branch, changes: proposal.changes.map(c => ({...c})) });
  return { status: result?.staged === true ? 'staged_for_review' : 'staging_failed', executed: result?.staged === true, reviewReference: result?.reviewReference ?? null };
}
export default async function code({ instruction = '', data = {} } = {}, context = {}) {
  if (context.signal?.aborted) throw new Error('code_aborted');
  if(typeof context.codeOperation==='function' && typeof data.project==='string')return context.codeOperation({...data,instruction});
  const operation = data.operation ?? 'inspect';
  if (operation === 'mission_check') return evaluateMissionStep(data.mission,data.step,context.authorizationVerified===true);
  if (operation === 'blackbox_plan') return planBlackBoxAssessment(data);
  if (operation === 'security_workflow') {
    const report=analyzeProject(data.files??[]);
    const priorities={high:0,medium:1,low:2};
    const findings=[...report.findings].sort((a,b)=>(priorities[a.severity]??3)-(priorities[b.severity]??3));
    const remediation={dynamic_code_execution:'Replace eval with a parser or an explicit allowlisted operation.',shell_execution_review:'Avoid shell interpolation and prefer argument-array APIs.',possible_embedded_credential:'Move credentials to a secret store and rotate exposed values.',dynamic_html_injection_review:'Use textContent or a trusted HTML sanitizer.',tls_verification_disabled:'Enable certificate verification and configure trusted certificates.',unfinished_work:'Review the unfinished task before deployment.',weak_randomness_review:'Use a cryptographically secure random generator for tokens or security-sensitive values.',debug_mode_enabled:'Disable debug mode in production and avoid exposing diagnostics.'};
    const reviewed=findings.map(item=>({...item,remediation:remediation[item.code]??'Review this finding and confirm exploitability before making changes.'}));
    return {status:'investigation_ready',executed:false,findings:reviewed,checkedFiles:report.files.length,summary:{high:findings.filter(f=>f.severity==='high').length,medium:findings.filter(f=>f.severity==='medium').length,low:findings.filter(f=>f.severity==='low').length},next:'review_findings_then_request_authorized_changes',limitations:[...report.limitations,'heuristics_not_proof_of_vulnerability']};
  }
  if (operation === 'defensive_review') {
    const report=analyzeProject(data.files??[]);
    return {status:'review_ready',executed:false,findings:report.findings,checkedFiles:report.files.length,limitations:[...report.limitations,'static_review_only']};
  }
  if (operation === 'generate') return generateCodeChanges({instruction:data.topic ?? instruction,files:data.files??[]});
  if (operation === 'run_tests') return context.allowIsolatedExecution===true ? runIsolatedNodeTests({files:data.files??[],timeoutMs:data.timeoutMs??12000}) : {status:'execution_permission_required',executed:false};
  if (operation === 'examples') return findCodeExamples(data.topic ?? instruction,data.limit ?? 3);
  if (operation === 'experience') return summarizeExperience(data.records ?? [],data.limit ?? 10);
  if (operation === 'cycle') return runDevelopmentCycle({...data,instruction:data.topic ?? instruction},{generateChanges:context.generateChanges ?? generateCodeChanges,prepareChanges,runChecks:context.runChecks ?? (context.allowIsolatedExecution===true ? checkNodeProposal : undefined)});
  if (operation === 'diagnose_and_fix') return runDevelopmentCycle({...data,instruction:data.topic ?? instruction},{generateChanges:context.generateChanges ?? generateCodeChanges,prepareChanges,runChecks:context.runChecks ?? (context.allowIsolatedExecution===true ? checkNodeProposal : undefined)});
  if (operation === 'develop') return developCode({...data,instruction:data.topic ?? instruction},{generateChanges:context.generateChanges,prepareChanges,runChecks:context.runChecks});
  if (operation === 'engineering') return engineeringBrief({instruction:data.topic ?? instruction,files:data.files ?? [],diagnostics:data.diagnostics ?? [],limit:data.limit ?? 5});
  if (operation === 'knowledge') return getCodeKnowledge({topic:data.topic ?? instruction,limit:data.limit ?? 5});
  if (operation === 'architecture') return mapArchitecture(data.files);
  if (operation === 'reason') return rankSolutions(data.options);
  if (operation === 'debug') return diagnoseFailures(data.diagnostics);
  if (operation === 'refactor_plan') return planRefactor(data.changes);
  if (operation === 'verify') return verifyCodeChange(data);
  if (operation === 'inspect') {
    if (!Array.isArray(data.files)) return { status: 'requires_project_files', instruction, executed: false };
    return analyzeProject(data.files);
  }
  if (operation === 'propose') return prepareChanges(data.files, data.changes);
  if (operation === 'stage') return applyApprovedProposal(data.proposal, data.approval, { stageChanges: context.stageChanges, verifyApproval: context.verifyApproval });
  return { status: 'unsupported_code_operation', executed: false };
}
