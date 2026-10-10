import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
const destinations=new Set(['pt.wikipedia.org','api.openalex.org']);
// SOCKS5 hostname mode resolves destination DNS through Tor. No direct fallback.
export function createTorFetch({run=execute}={}) {
 return async function torFetch(input,{signal,method='GET'}={}) {
  const url=new URL(input);
  if(url.protocol!=='https:' || !destinations.has(url.hostname) || url.username || url.password || url.port || method!=='GET')throw new Error('research_destination_blocked');
  if(signal?.aborted)throw new Error('research_aborted');
  try {
   const {stdout}=await run(process.platform==='win32'?'curl.exe':'curl', ['--disable','--silent','--show-error','--socks5-hostname','127.0.0.1:9050','--noproxy','','--proto','=https','--connect-timeout','15','--max-time','25','--max-filesize','1048576','--header','Accept: application/json','--write-out','\n%{http_code}',url.href], {signal,timeout:27000,maxBuffer:1049600,windowsHide:true,encoding:'utf8'});
   const split=stdout.lastIndexOf('\n');const status=Number(stdout.slice(split+1));const body=stdout.slice(0,split);
   if(!Number.isInteger(status)||status<100||status>599)throw new Error('invalid_response');
   return {ok:status>=200&&status<300,status,json:async()=>JSON.parse(body)};
  } catch {throw new Error(signal?.aborted?'research_aborted':'tor_transport_unavailable');}
 };
}
