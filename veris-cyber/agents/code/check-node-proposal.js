import { runIsolatedNodeTests } from './isolated-runner.js';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { parseArgs }=require('node:util');

// Executes a proposed Node.js test suite in Docker, never on the host.
export async function checkNodeProposal({proposal,files=[]}={}) {
 if(proposal?.status!=='proposal_ready'||!Array.isArray(proposal.changes))throw new TypeError('invalid_proposal');
 const merged=new Map(files.map(f=>[f.path,{path:f.path,content:f.content}]));
 for(const change of proposal.changes)merged.set(change.path,{path:change.path,content:change.content});
 const suite=[...merged.values()].filter(f=>/\.(?:m?js|json)$/.test(f.path));
 const result=await runIsolatedNodeTests({files:suite});
 const record={name:'node --test',source:'docker-node',status:result.status==='passed'?'passed':'failed',message:result.status};
 const staticAnalysis=[{name:'file policy',source:'code-static',status:suite.length>0&&suite.every(f=>typeof f.content==='string'&&f.content.length<=200000)?'passed':'failed'}];
 return {testResults:[record],staticAnalysis,runnerResult:result};
}
