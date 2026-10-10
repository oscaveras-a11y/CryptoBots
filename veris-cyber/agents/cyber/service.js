import {randomUUID,createHash} from 'node:crypto';
const key=f=>[f.path,f.rule,f.line].join(':');
const clean=x=>String(x).replace(/[\r\n`<>]/g,' ').slice(0,300);
export function createCyberService({codeService,maxHistory=20}={}){
 if(!codeService||typeof codeService.authorize!=='function'||typeof codeService.securityAudit!=='function')throw new TypeError('trusted_cyber_adapter_required');
 if(!Number.isInteger(maxHistory)||maxHistory<1||maxHistory>100)throw new TypeError('invalid_cyber_history');
 const jobs=new Map();
 const snapshot=job=>structuredClone({jobId:job.id,project:job.project,status:job.status,createdAt:job.createdAt,completedAt:job.completedAt??null,report:job.report??null,error:job.error??null});
 function trim(){for(const [id,job] of jobs){if(jobs.size<maxHistory)break;if(!['queued','running'].includes(job.status))jobs.delete(id);}}
 async function operation({operation,project,permissionId,jobId,baselineId}={}){
  const access=codeService.authorize({operation:'security-audit',project,permissionId});
  if(access.allowed!==true)return {status:access.reason??'task_permission_required',executed:false};
  if(operation==='start'){
   trim();if(jobs.size>=maxHistory)return {status:'cyber_queue_full'};
   const previous=baselineId?jobs.get(baselineId):null;
   if(baselineId&&(!previous||previous.project!==project||previous.status!=='completed'))return {status:'baseline_not_available'};
   const baseline=previous?.report;
   if(baseline){const check=codeService.authorize({operation:'security-audit',project,permissionId,paths:previous.accessPaths});if(!check.allowed)return {status:check.reason??'path_out_of_scope'};}
   const job={id:randomUUID(),project,status:'queued',createdAt:new Date().toISOString(),controller:new AbortController()};jobs.set(job.id,job);
   setImmediate(async()=>{
    if(job.controller.signal.aborted)return;
    job.status='running';
    try{
     const result=await codeService.securityAudit(project,permissionId,{signal:job.controller.signal});
     if(job.controller.signal.aborted){job.status='cancelled';return;}
     job.accessPaths=[...new Set([...(result.scannedPaths??[]),...(previous?.accessPaths??[])])];
     // Recheck owner authority before retaining any report after a long read.
     if(!codeService.authorize({operation:'security-audit',project,permissionId,paths:job.accessPaths}).allowed)throw new Error('task_permission_required');
     if(result.status!=='audited')throw new Error('audit_unavailable');
     const findings=result.findings.map(f=>({...f,id:createHash('sha256').update(key(f)).digest('hex').slice(0,20)}));
     const current=new Set(findings.map(key)),old=new Set((baseline?.findings??[]).map(key));
     job.report={...result,findings,verified:false,comparison:baseline?{baselineId,newFindings:findings.filter(f=>!old.has(key(f))),noLongerDetected:baseline.findings.filter(f=>!current.has(key(f))),conclusive:!result.truncated&&!baseline.truncated}:null};
     job.status='completed';
    }catch(error){job.status=job.controller.signal.aborted?'cancelled':'failed';job.error=['task_permission_required','audit_unavailable'].includes(error.message)?error.message:'local_audit_failed';}
    finally{job.completedAt=new Date().toISOString();}
   });
   return snapshot(job);
  }
  const job=jobs.get(jobId);if(!job||job.project!==project)return {status:'job_not_available'};
  if(job.report){const check=codeService.authorize({operation:'security-audit',project,permissionId,paths:job.accessPaths});if(!check.allowed)return {status:check.reason??'path_out_of_scope'};}
  if(operation==='cancel'){
   if(!['queued','running'].includes(job.status))return {status:'job_not_cancellable'};
   job.controller.abort();job.status='cancelled';job.completedAt=new Date().toISOString();return snapshot(job);
  }
  if(operation==='get')return snapshot(job);
  if(operation==='report'&&job.status==='completed'){
   const r=job.report;
   const markdown=['# JARVIS CYBER',`Projeto: ${clean(project)}`,`Achados heurísticos: ${r.findings.length}`,`Cobertura limitada: ${r.truncated?'sim':'não'}`,'','## Achados',...r.findings.map(f=>`- ${clean(f.severity)} · ${clean(f.path)}:${f.line} · ${clean(f.rule)} — ${clean(f.remediation)}`),'','## Dependências',...r.dependencies.packages.map(p=>`- ${clean(p.name)} ${clean(p.version)} (${p.kind}): vulnerabilidades não consultadas`),'','## Limitações','Análise estática heurística; não é pentest nem prova de segurança. Valores de segredos e código-fonte não são exportados. Achados ausentes na segunda varredura não comprovam correção.'].join('\n');
   return {status:'report_ready',report:structuredClone(r),markdown};
  }
  return {status:'unsupported_cyber_operation'};
 }
 return {operation};
}
