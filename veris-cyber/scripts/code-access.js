// Run locally as the owner. Never called by the HTTP service.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCodeAuthority} from '../agents/code/authority.js';
const defaultFile=fileURLToPath(new URL('../config/code-authority.json',import.meta.url));
export async function runCodeAccess(args,{file=defaultFile}={}){
  const [command,input,actor]=args;
  if(!['grant','approve','revoke'].includes(command)||!input||(command==='revoke'&&!actor))throw new Error('usage: code-access grant|approve <local-json-file> OR revoke <id> <actor>');
  const authority=createCodeAuthority({file});
  if(command==='revoke')return {revoked:authority.revoke(input,actor)};
  const value=JSON.parse(await readFile(resolve(input),'utf8'));
  return command==='grant'?{permissionId:authority.grant(value)}:{approvalId:authority.approve(value)};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(await runCodeAccess(process.argv.slice(2))));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
