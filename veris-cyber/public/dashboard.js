'use strict';
const $=id=>document.getElementById(id);
let credential='',proposal=null,reviewReference=null,lastAnswer='';
let sessionVersion=0;
let dashboardTimer=null;
function renderDashboard(snapshot){
  if(!snapshot || !Array.isArray(snapshot.agents))throw new Error('Resposta inválida do CORE');
  $('agents').replaceChildren();
  for(const agent of snapshot.agents){
    const card=document.createElement('div');
    card.className='agent'+(agent.ready?' connected':'');
    const title=document.createElement('strong');title.textContent=agent.name.toUpperCase();
    const state=document.createElement('small');
    state.textContent=!agent.registered?'Não registrado':agent.ready?'Capacidade disponível':'Integração pendente';
    card.append(title,state);$('agents').append(card);
  }
  const count=snapshot.agents.filter(a=>a.ready).length;
  const status=$('core-status');
  if(status)status.textContent=count+' de '+snapshot.agents.length+' capacidades disponíveis · fila: '+(snapshot.queue?.pending??'—');
}
async function refreshDashboard(){
  if(!credential)return;
  try{renderDashboard(await api('/api/core/dashboard'));}
  catch(error){if(credential){$('connection').textContent='Sem comunicação com CORE';notice(error.message);}}
}

const pendingRequests=new Set();
const statusLabels={requires_code_service:'Cadastre o projeto em config/projects.json e reinicie o servidor.',task_permission_required:'Emita uma permissão local válida para esta operação.',approval_required:'Emita uma aprovação local vinculada a esta proposta ou revisão.',path_out_of_scope:'O caminho está fora da permissão concedida.',proposal_not_available:'A proposta expirou ou o servidor reiniciou. Proponha novamente.',no_changes_needed:'Nenhuma alteração necessária.',invalid_code_request:'Solicitação recusada. Confira os caminhos, hashes e a configuração local.'};
function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');}
function present(result){return statusLabels[result.status??result.error]??JSON.stringify(result,null,2);}
async function api(route,body){
  if(!credential)throw new Error('Conecte com sua credencial local primeiro.');
  const version=sessionVersion,controller=new AbortController();pendingRequests.add(controller);
  try{
    const response=await fetch(route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+credential,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});
    const result=await response.json();if(version!==sessionVersion)throw new Error('Resposta descartada: a sessão foi encerrada.');if(!response.ok)throw new Error(statusLabels[result.error]??'Solicitação recusada ('+response.status+').');return result;
  }finally{pendingRequests.delete(controller);}
}
async function action(button,work){button.disabled=true;try{await work();}catch(error){notice(error.message);}finally{button.disabled=false;}}
function codeRequest(operation,extra={}){return api('/api/code',{operation,project:$('project').value.trim(),permissionId:$('permission').value.trim(),...extra});}
function clearState(){if(dashboardTimer!==null){clearInterval(dashboardTimer);dashboardTimer=null;}sessionVersion++;for(const controller of pendingRequests)controller.abort();pendingRequests.clear();credential='';proposal=null;reviewReference=null;lastAnswer='';$('token').value='';$('permission').value='';$('approval').value='';$('rollback-approval').value='';$('action-permission').value='';$('action-content').value='';$('action-result').textContent='Nenhuma ferramenta executada.';$('connection').textContent='Desconectado';$('agents').replaceChildren();$('proposal').textContent='Nenhuma proposta.';$('review').textContent='';$('answer').textContent='Aguardando seu pedido.';globalThis.speechSynthesis?.cancel();}
// Capture the entered credential before clearing sensitive state.
$('connect').onsubmit=event=>{event.preventDefault();const value=$('token').value.trim();action(event.submitter,async()=>{clearState();credential=value;const version=sessionVersion;try{const result=await api('/api/core/dashboard');renderDashboard(result);$('connection').textContent='Conectado · local';dashboardTimer=setInterval(refreshDashboard,10000);}catch(error){if(version===sessionVersion)clearState();throw error;}});};
$('disconnect').onclick=clearState;
$('chat').onsubmit=event=>{event.preventDefault();action(event.submitter,async()=>{const result=await api('/api/core/run',{message:$('message').value,mode:'informational'});lastAnswer=result.answer??present(result);$('answer').textContent=lastAnswer;});};
$('plan').onclick=()=>action($('plan'),async()=>{$('answer').textContent=present(await api('/api/assistant/plan',{message:$('message').value}));lastAnswer=$('answer').textContent;});
$('speak').onclick=()=>{if(!lastAnswer)return notice('Consulte o CORE primeiro.');if(!globalThis.speechSynthesis)return notice('Leitura em voz alta indisponível neste navegador.');const voice=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith('pt'));if(!voice)return notice('Nenhuma voz local em português disponível. Instale uma voz do Windows nas configurações de idioma.');speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(lastAnswer.slice(0,4000));speech.voice=voice;speech.lang=voice.lang;speechSynthesis.speak(speech);};
$('code').onsubmit=event=>{event.preventDefault();action(event.submitter,async()=>{proposal=null;reviewReference=null;$('review').textContent='';const options={operation:$('operation').value,path:$('path').value.trim(),from:$('from').value,to:$('to').value};const result=await codeRequest('propose',{instruction:'Operação explícita do proprietário',options});$('proposal').textContent=present(result);if(result.status==='proposal_ready')proposal={id:result.proposalId,project:$('project').value.trim()};});};
$('inspect').onclick=()=>action($('inspect'),async()=>{$('proposal').textContent=present(await codeRequest('inspect'));});
$('stage').onclick=()=>action($('stage'),async()=>{if(!proposal||proposal.project!==$('project').value.trim())throw new Error('Gere e revise uma proposta para este projeto primeiro.');const result=await codeRequest('stage',{proposalId:proposal.id,approvalId:$('approval').value.trim()});$('review').textContent=present(result);if(result.status==='staged_for_review'){reviewReference={id:result.reviewReference,project:proposal.project};$('proposal').textContent=present(await codeRequest('describe',{reviewReference:reviewReference.id}));}});
$('rollback').onclick=()=>action($('rollback'),async()=>{if(!reviewReference||reviewReference.project!==$('project').value.trim())throw new Error('Crie uma cópia revisável para este projeto primeiro.');const result=await codeRequest('rollback',{reviewReference:reviewReference.id,approvalId:$('rollback-approval').value.trim()});$('review').textContent=present(result);});

$('action-tools').onsubmit=event=>{event.preventDefault();action(event.submitter,async()=>{const result=await api('/api/action',{tool:$('action-tool').value,project:$('action-project').value.trim(),permissionId:$('action-permission').value.trim(),path:$('action-path').value.trim(),content:$('action-content').value});$('action-result').textContent=present(result);});};
