import {spawn} from 'node:child_process';
import {platform} from 'node:os';

// Read-only Windows inventory. Fixed commands only: no user-provided PowerShell.
const COMMANDS=Object.freeze({
 system:'Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber | ConvertTo-Json -Compress',
 firewall:'Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction | ConvertTo-Json -Compress',
 defender:'Get-MpComputerStatus | Select-Object AMServiceEnabled,AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated | ConvertTo-Json -Compress',
 listeners:'Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress',
 sharing:'Get-SmbShare | Select-Object Name,Description,Special | ConvertTo-Json -Compress'
});
export const WINDOWS_CHECKS=Object.freeze(Object.keys(COMMANDS));
export async function runWindowsReadOnlyCheck({check,approved=false,signal,timeoutMs=6000}={}){
 if(platform()!=='win32')return {status:'windows_required',executed:false};
 if(approved!==true)return {status:'approval_required',executed:false};
 if(!Object.hasOwn(COMMANDS,check))return {status:'unsupported_check',executed:false};
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)return {status:'invalid_timeout',executed:false};
 if(signal?.aborted)return {status:'cancelled',executed:false};
 return new Promise(resolve=>{
  let settled=false,stdout='',stderr='',timedOut=false;
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',COMMANDS[check]],{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve(result);};
  const abort=()=>{child.kill();finish({status:'cancelled',executed:false});};
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  child.stdout.on('data',chunk=>{stdout+=chunk.toString('utf8');if(stdout.length>100000)child.kill();});
  child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');if(stderr.length>20000)child.kill();});
  child.on('error',()=>finish({status:'tool_unavailable',executed:false}));
  child.on('close',code=>{
   if(timedOut)return finish({status:'timeout',executed:false});
   if(code!==0||stdout.length>100000)return finish({status:'check_failed',executed:false});
   try{finish({status:'completed',executed:true,check,evidence:JSON.parse(stdout)});}
   catch{finish({status:'invalid_tool_output',executed:false});}
  });
 });
}
