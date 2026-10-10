import { runIsolatedNodeTests } from './isolated-runner.js';

// Executes a proposed Node.js test suite in Docker, never on the host.
export async function checkNodeProposal({proposal,files=[]}={}) {
 if(proposal?.status!=='proposal_ready'||!Array.isArray(proposal.changes))throw new TypeError('invalid_proposal');
 const merged=new Map(files.map(f=>[f.path,{path:f.path,content:f.content}]));
 for(const change of proposal.changes)merged.set(change.path,{path:change.path,content:change.content});
 const suite=[...merged.values()].filter(f=>/\.(?:m?js|json)$/.test(f.path));
 const result=await runIsolatedNodeTests({files:suite});
 const record={name:'node --test',source:'docker-node',status:result.status==='passed'?'passed':'failed',message:result.status};
 return {testResults:[record],staticAnalysis:[],runnerResult:result};
}
