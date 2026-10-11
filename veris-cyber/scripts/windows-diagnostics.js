import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runWindowsReadOnlyCheck,WINDOWS_CHECKS} from '../agents/cyber/windows-native.js';
import {checkWindowsTcpPorts} from '../agents/cyber/linux-windows-probe.js';

// Operator-controlled Windows diagnostics; no implicit execution or file changes.
try{
 const file=process.argv[2];
 if(!file)throw Error('request_file_required');
 const request=JSON.parse(await readFile(resolve(file),'utf8'));
 let result;
 if(request.type==='local')result=await runWindowsReadOnlyCheck({check:request.check,approved:request.approved===true});
 else if(request.type==='network')result=await checkWindowsTcpPorts({host:request.host,ports:request.ports,authorization:request.authorization});
 else result={status:'unsupported_request',executed:false};
 console.log(JSON.stringify(result,null,2));
 if(result.executed!==true)process.exitCode=1;
}catch{console.error(JSON.stringify({status:'invalid_request',executed:false,checks:WINDOWS_CHECKS}));process.exitCode=1;}
