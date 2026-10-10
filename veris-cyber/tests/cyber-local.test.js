import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCodeService} from '../agents/code/service.js';
import {createCyberService} from '../agents/cyber/service.js';
import {inventoryDependencies} from '../agents/cyber/dependencies.js';
import {authorizeCodeTask} from '../agents/code/permissions.js';

test('inventory distinguishes declarations, locked packages and unknown vulnerability status',()=>{
 const result=inventoryDependencies([{path:'package.json',content:JSON.stringify({dependencies:{express:'^4.0.0'}})},{path:'package-lock.json',content:JSON.stringify({packages:{'node_modules/express':{name:'express',version:'4.17.1'}}})}]);
 assert.equal(result.packages.find(p=>p.source==='package-lock.json').version,'4.17.1');
 assert.ok(result.packages.every(p=>p.vulnerabilityStatus==='not_checked'));
 assert.equal(inventoryDependencies([{path:'package.json',content:'bad'}]).warnings.length,1);
 const sensitive=inventoryDependencies([{path:'package.json',content:JSON.stringify({dependencies:{internal:'git+https://user:SUPERSECRET@example.com/repo.git'}})}]);
 assert.ok(!JSON.stringify(sensitive).includes('SUPERSECRET'));
 assert.equal(sensitive.packages[0].kind,'non_registry');
});

test('CYBER cancellation discards late results and revoked permissions block access',async()=>{
 let finish,allowed=true;
 const code={authorize:()=>({allowed,reason:'task_permission_required'}),securityAudit:()=>new Promise(r=>{finish=r;})};
 const cyber=createCyberService({codeService:code});
 const job=await cyber.operation({operation:'start',project:'lab',permissionId:'permit'});
 await new Promise(r=>setImmediate(r));
 assert.equal((await cyber.operation({operation:'cancel',project:'lab',permissionId:'permit',jobId:job.jobId})).status,'cancelled');
 finish({status:'audited',findings:[],scannedPaths:[],dependencies:{packages:[]}});await new Promise(r=>setImmediate(r));
 const result=await cyber.operation({operation:'get',project:'lab',permissionId:'permit',jobId:job.jobId});assert.equal(result.status,'cancelled');assert.equal(result.report,null);
 allowed=false;assert.equal((await cyber.operation({operation:'get',project:'lab',permissionId:'permit',jobId:job.jobId})).status,'task_permission_required');
});

test('CYBER runs only owner-authorized local scans and compares server-owned reports',async()=>{
 const root=await mkdtemp(join(tmpdir(),'jarvis-cyber-'));
 try{
  await writeFile(join(root,'app.js'),'const password="a-secret-never-returned"; eval(input);');
  await writeFile(join(root,'package.json'),JSON.stringify({dependencies:{express:'^4.0.0'}}));
  const grant={confirmed:true,project:'lab',operations:['security-audit'],allowPaths:['app.js','package.json'],denyPaths:[],expiresAt:Date.now()+60000};
  const code=createCodeService({trustedProjects:{lab:root},resolveTaskPermission:id=>id==='permit'?grant:null});
  // Production host wrapper uses the same authority for reads and report access.
  code.authorize=({project,permissionId,paths=[]})=>authorizeCodeTask(permissionId==='permit'?grant:permissionId==='narrow'?{...grant,allowPaths:['package.json']}:null,{operation:'security-audit',project,paths});
  const cyber=createCyberService({codeService:code});
  assert.equal((await cyber.operation({operation:'start',project:'lab',permissionId:'fake'})).status,'task_permission_required');
  const job=await cyber.operation({operation:'start',project:'lab',permissionId:'permit'});
  let result;for(let i=0;i<100;i++){result=await cyber.operation({operation:'get',project:'lab',permissionId:'permit',jobId:job.jobId});if(result.status!=='running'&&result.status!=='queued')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(result.status,'completed');assert.equal(result.report.findings.length,2);
  assert.ok(!JSON.stringify(result).includes('a-secret-never-returned'));
  assert.equal(result.report.dependencies.packages.length,1);
  assert.equal((await cyber.operation({operation:'get',project:'lab',permissionId:'narrow',jobId:job.jobId})).status,'path_out_of_scope');
  assert.equal((await cyber.operation({operation:'start',project:'lab',permissionId:'narrow',baselineId:job.jobId})).status,'path_out_of_scope');
  const exported=await cyber.operation({operation:'report',project:'lab',permissionId:'permit',jobId:job.jobId});assert.match(exported.markdown,/JARVIS CYBER/);
  assert.equal((await cyber.operation({operation:'get',project:'lab',permissionId:'fake',jobId:job.jobId})).status,'task_permission_required');
  await writeFile(join(root,'app.js'),'console.log("safe");');
  const second=await cyber.operation({operation:'start',project:'lab',permissionId:'permit',baselineId:job.jobId});
  for(let i=0;i<100;i++){result=await cyber.operation({operation:'get',project:'lab',permissionId:'permit',jobId:second.jobId});if(result.status!=='running'&&result.status!=='queued')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(result.report.comparison.noLongerDetected.length,2);assert.equal(result.report.verified,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
