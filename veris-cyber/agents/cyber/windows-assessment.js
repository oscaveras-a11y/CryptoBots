// Read-only Windows security assessment plan. No commands are executed here.
export function prepareWindowsAssessment({computer,authorization}={}){
 if(typeof computer!=='string'||!computer.trim()||computer.length>120)return {status:'computer_required',executed:false};
 if(!authorization||authorization.confirmed!==true||typeof authorization.reference!=='string'||!authorization.reference.trim())return {status:'authorization_required',executed:false};
 const checks=[
  {id:'host',phase:'local',description:'Identify Windows version, build and installed updates',requires:'read_only_windows_adapter'},
  {id:'firewall',phase:'local',description:'Inspect firewall profiles and inbound rules',requires:'read_only_windows_adapter'},
  {id:'defender',phase:'local',description:'Inspect Defender status and protection settings',requires:'read_only_windows_adapter'},
  {id:'services',phase:'local',description:'Inventory listening ports and associated services',requires:'read_only_windows_adapter'},
  {id:'accounts',phase:'local',description:'Review local administrator membership and account policies without exposing secrets',requires:'read_only_windows_adapter'},
  {id:'sharing',phase:'local',description:'Review SMB, RDP and network sharing exposure',requires:'read_only_windows_adapter'},
  {id:'network',phase:'network',description:'Check only approved host ports from an isolated test machine',requires:'scoped_network_adapter'},
  {id:'report',phase:'review',description:'Correlate evidence, severity and recommended remediations',requires:'evidence_review'}
 ];
 return {status:'assessment_ready',computer,authorizationReference:authorization.reference,executed:false,requiresApprovalBeforeExecution:true,requiresTrustedRunner:true,checks,limitations:['no_probe_performed','authorization_not_independently_verified','no_exploitation_or_credential_access']};
}
