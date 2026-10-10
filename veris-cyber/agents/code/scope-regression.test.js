import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createCodeService} from './service.js';
test('CODE never returns or proposes edits to a file denied by a trusted grant',async t=>{
const root=await mkdtemp(join(tmpdir(),'jarvis-scope-'));t.after(()=>rm(root,{recursive:true,force:true}));
await writeFile(join(root,'allowed.js'),'const visible = 1;');await writeFile(join(root,'denied.js'),'eval(confidentialInput);');
const grants={confirmed:true,project:'demo',operations:['inspect','propose','security-audit'],allowPaths:['allowed.js','denied.js'],denyPaths:['denied.js'],expiresAt:Date.now()+60000};
let observed=[];const service=createCodeService({trustedProjects:{demo:root},resolveTaskPermission:async()=>grants,generateChanges:async({files})=>{observed=files;return [];}});
const inspected=await service.inspect('demo','task');assert.equal(JSON.stringify(inspected).includes('denied.js'),false);
const audited=await service.securityAudit('demo','task');assert.equal(JSON.stringify(audited).includes('denied.js'),false);assert.equal(audited.findings.length,0);
await service.propose('demo','Review permitted source',{},'task');assert.deepEqual(observed.map(f=>f.path),['allowed.js']);
});
