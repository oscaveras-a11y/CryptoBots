// Deterministic project-context retrieval for CODE. No external model or network.
const WORD=/[\p{L}\p{N}_-]{3,}/gu;
const tokens=value=>new Set((String(value).toLocaleLowerCase('pt-BR').match(WORD)??[]).slice(0,200));
const allowed=/\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|md|html|css|sql|ya?ml)$/i;
const secret=/(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|node_modules|\.git|.*\.(?:pem|key|p12))$/i;
export function retrieveCodeContext({instruction='',files=[],limit=8,maxChars=12000}={}){
 if(typeof instruction!=='string'||!instruction.trim()||instruction.length>4000)return {status:'invalid_instruction',selected:[]};
 if(!Array.isArray(files)||files.length>500)return {status:'invalid_files',selected:[]};
 if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isInteger(maxChars)||maxChars<100||maxChars>50000)return {status:'invalid_limits',selected:[]};
 const query=tokens(instruction),candidates=[];
 for(const file of files){
  if(!file||typeof file.path!=='string'||typeof file.content!=='string'||file.content.length>200000||!allowed.test(file.path)||secret.test(file.path))continue;
  const pathTokens=tokens(file.path.replace(/[/.]/g,' '));
  const contentTokens=tokens(file.content.slice(0,30000));
  let score=0;
  for(const term of query){if(pathTokens.has(term))score+=5;if(contentTokens.has(term))score+=1;}
  if(score>0)candidates.push({path:file.path,score,content:file.content});
 }
 candidates.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
 let remaining=maxChars;
 const selected=[];
 for(const file of candidates.slice(0,limit)){
  if(remaining<=0)break;
  const content=file.content.slice(0,remaining);
  selected.push({path:file.path,score:file.score,content,truncated:content.length<file.content.length});
  remaining-=content.length;
 }
 return {status:'context_ready',selected,totalCandidates:candidates.length,executed:false,limitations:['lexical_retrieval_only','context_not_verified']};
}
