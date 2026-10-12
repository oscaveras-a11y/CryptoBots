import net from 'node:net';
import {isIP} from 'node:net';

// Safe, bounded TCP reachability checks from Linux to a specifically approved Windows host.
// This module does not authenticate, exploit, or modify the target.
export async function checkWindowsTcpPorts({host,ports=[135,139,445,3389,5985,5986],timeoutMs=1200,authorization,signal}={}){
 if(typeof host!=='string'||isIP(host)===0)return {status:'invalid_host',executed:false,results:[]};
 if(!authorization||authorization.confirmed!==true||authorization.target!==host)return {status:'authorization_required',executed:false,results:[]};
 if(!Array.isArray(ports)||ports.length<1||ports.length>16||!ports.every(p=>Number.isInteger(p)&&p>=1&&p<=65535))return {status:'invalid_ports',executed:false,results:[]};
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>5000)return {status:'invalid_timeout',executed:false,results:[]};
 const results=[];
 for(const port of ports){
  if(signal?.aborted)return {status:'cancelled',executed:results.length>0,results};
  const state=await new Promise(resolve=>{
   const socket=new net.Socket();let settled=false;
   const done=(value)=>{if(settled)return;settled=true;socket.destroy();signal?.removeEventListener('abort',onAbort);resolve(value);};
   const onAbort=()=>done('cancelled');
   signal?.addEventListener('abort',onAbort,{once:true});
   socket.setTimeout(timeoutMs,()=>done('timeout'));
   socket.once('connect',()=>done('open'));
   socket.once('error',err=>done(err.code==='ECONNREFUSED'?'closed':'unreachable'));
   if(signal?.aborted){done('cancelled');return;}
   socket.connect(port,host);
  });
  if(state==='cancelled')return {status:'cancelled',executed:results.length>0,results};
  results.push({port,state});
 }
 return {status:'completed',executed:true,host,results,limitations:['tcp_connect_only','no_vulnerability_confirmation']};
}
