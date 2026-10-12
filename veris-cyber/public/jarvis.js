'use strict';
const $=id=>document.getElementById(id);
const canvas=$('core'),ctx=canvas.getContext('2d');
const names=['sense','mind','memory','planner','research','code','cyber','action','guard','verify','vision','voice'];
let token='',session=0,timer=null,lastAnswer='',mode='idle',busy=false,recognition=null,activeSpeech=null,taskController=null,agentTrace=new Map();
const labels={idle:['NÚCLEO EM REPOUSO','Aguardando comando'],listening:['OUVINDO','Escutando comando'],thinking:['PROCESSANDO','Consultando CORE'],speaking:['FALANDO','Transmitindo resposta']};
const COUNT=6800;
const particles=Array.from({length:COUNT},(_,i)=>{
 const y=1-2*(i+.5)/COUNT,phi=i*2.399963229728653,r=Math.sqrt(1-y*y);
 const shell=.42+.58*Math.pow((Math.sin(i*78.233)*43758.5453)%1,2);
 return {x:r*Math.cos(phi)*shell,y:y*shell,z:r*Math.sin(phi)*shell,
 phase:i*1.6180339,speed:.22+(i%13)/35,brightness:.45+(i%17)/30};
});
function state(next){
 if(!labels[next])return;
 mode=next;
 document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b.dataset.mode===next);b.setAttribute('aria-pressed',String(b.dataset.mode===next));});
 $('core-state').textContent=labels[next][0];
 $('feed-title').textContent=labels[next][1];
}
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>state(b.dataset.mode)));
let lastFrame=0;
function render(t){
 if(t-lastFrame<33){requestAnimationFrame(render);return;}
 lastFrame=t;
 const dpr=Math.min(devicePixelRatio||1,1.5),w=canvas.clientWidth,h=canvas.clientHeight;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
 const R=Math.min(w*.39,h*.44,510),cx=w/2,cy=h/2,sec=t/1000;
 const activity=mode==='thinking'?1.9:mode==='speaking'?1.4:mode==='listening'?1.2:.7;
 const pulse=1+.017*Math.sin(sec*1.3*activity);
 const haze=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.04);
 haze.addColorStop(0,'rgba(255,163,18,.15)');haze.addColorStop(.5,'rgba(255,134,0,.035)');haze.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=haze;ctx.fillRect(cx-R*1.1,cy-R*1.1,R*2.2,R*2.2);
 for(let i=0;i<particles.length;i++){
  const p=particles[i];
  const swirl=sec*p.speed*.22*activity+.12*Math.sin(sec*.7+p.phase);
  const co=Math.cos(swirl),si=Math.sin(swirl);
  const x=p.x*co-p.z*si,z=p.x*si+p.z*co;
  const flow=.028*Math.sin(sec*activity*.8+p.phase)*Math.max(.1,1-Math.abs(p.y));
  const y=p.y+flow;
  const depth=1+.17*z;
  const px=cx+x*R*depth*pulse,py=cy+y*R*depth*pulse;
  const shimmer=.53+.47*Math.sin(sec*(.9+p.speed)*activity+p.phase*2);
  const alpha=Math.min(1,(.19+.56*(z+1)/2)*shimmer*p.brightness);
  const radius=(i%67===0?2.0:i%11===0?1.05:.52)*(0.8+alpha*.5);
  ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);
  ctx.fillStyle='rgba(255,'+(165+Math.floor(alpha*65))+',55,'+alpha.toFixed(3)+')';ctx.fill();
 }
 const core=ctx.createRadialGradient(cx,cy,0,cx,cy,R*.19);
 core.addColorStop(0,'rgba(255,239,155,.88)');core.addColorStop(.10,'rgba(255,193,55,.42)');core.addColorStop(1,'rgba(255,160,0,0)');
 ctx.fillStyle=core;ctx.beginPath();ctx.arc(cx,cy,R*.19,0,Math.PI*2);ctx.fill();
 requestAnimationFrame(render);
}
requestAnimationFrame(render);
const panelToggle=$('panel-toggle');
panelToggle.addEventListener('click',()=>{
 const open=document.body.classList.toggle('panel-open');
 panelToggle.setAttribute('aria-expanded',String(open));
 panelToggle.textContent=open?'FECHAR PAINEL':'PAINEL';
});
function notice(message){$('notice').textContent=message;}
async function api(path,body){if(!token)throw new Error('Conecte o CORE com sua credencial local.');const version=session;const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await response.json();if(version!==session)throw new Error('Sessão encerrada.');if(!response.ok)throw new Error('CORE retornou '+response.status+': '+(data.error||'erro'));return data;}
function showAgents(agents){$('agent-grid').replaceChildren();for(const name of names){const a=agents.find(item=>item.name===name);const card=document.createElement('div');card.className='agent'+(a?.ready?' ready':'');const title=document.createElement('strong');title.textContent=name.toUpperCase();const small=document.createElement('small');small.textContent=agentTrace.has(name)?'ÚLTIMA TAREFA: '+agentTrace.get(name):!a?.registered?'NÃO REGISTRADO':a.ready?'DISPONÍVEL':'PENDENTE';card.append(title,small);$('agent-grid').append(card);}const ready=agents.filter(a=>a.ready).length;$('readiness').textContent=ready+'/12';}
function showSnapshot(data){showAgents(data.agents||[]);$('queue').textContent=String(data.queue?.pending??'—');$('pending').textContent=String(data.queue?.pending??'—');$('running').textContent=String(data.queue?.active??'—');$('core-link').textContent='CONECTADO';$('connection').textContent='● CORE CONECTADO';}
async function refresh(){if(!token)return;try{showSnapshot(await api('/api/core/dashboard'));}catch(e){$('connection').textContent='● CORE INDISPONÍVEL';notice(e.message);}}
function disconnect(){session++;agentTrace.clear();taskController?.abort();taskController=null;recognition?.abort();recognition=null;activeSpeech=null;busy=false;token='';clearInterval(timer);timer=null;$('token').value='';$('connection').textContent='DESCONECTADO';$('core-link').textContent='DESCONECTADO';$('readiness').textContent='—';$('queue').textContent='—';$('pending').textContent='—';$('running').textContent='—';showAgents([]);globalThis.speechSynthesis?.cancel();state('idle');}
$('connect').onclick=async()=>{const candidate=$('token').value.trim();disconnect();token=candidate;try{await refresh();if($('connection').textContent!=='● CORE CONECTADO')throw new Error('Não foi possível autenticar.');timer=setInterval(refresh,10000);$('token').value='';notice('Conectado ao CORE local.');}catch(e){disconnect();notice(e.message);}};
$('disconnect').onclick=()=>{disconnect();notice('Sessão encerrada.');};
$('chat').onsubmit=async e=>{e.preventDefault();if(busy)return;const input=$('prompt').value.trim();if(!input)return;const version=session;busy=true;state('thinking');$('reply').textContent='Processando sua solicitação...';try{const submitted=await api('/api/core/tasks',{message:input,mode:'informational'});if(!submitted.id)throw new Error('CORE não retornou um ID de tarefa.');const controller=new AbortController();taskController=controller;let job;for(let attempt=0;attempt<120;attempt++){if(controller.signal.aborted||version!==session)return;job=await api('/api/core/tasks/'+encodeURIComponent(submitted.id));$('feed-description').textContent='Tarefa '+submitted.id.slice(0,8)+' · '+job.status;if(['completed','failed','cancelled'].includes(job.status))break;await new Promise((resolve,reject)=>{const timeout=setTimeout(resolve,500);controller.signal.addEventListener('abort',()=>{clearTimeout(timeout);resolve();},{once:true});});}if(!job||!['completed','failed','cancelled'].includes(job.status))throw new Error('A tarefa continua no CORE. Consulte a fila para acompanhar.');if(job.status!=='completed')throw new Error('Tarefa '+job.status+': '+(job.error??'sem resultado'));const result=job.result??{};agentTrace=new Map((Array.isArray(result.trace)?result.trace:[]).filter(step=>names.includes(step.agent)).map(step=>[step.agent,String(step.status??'desconhecido').toUpperCase()]));await refresh();lastAnswer=typeof result.answer==='string'&&result.answer.trim()?result.answer:JSON.stringify({status:result.status,reason:result.reason??null},null,2);$('reply').textContent=lastAnswer;$('feed-description').textContent='CORE respondeu: '+(result.status??'resultado recebido');$('prompt').value='';}catch(err){if(version===session)$('reply').textContent=err.message;}finally{if(version===session){taskController=null;busy=false;state('idle');}}};
$('speak').onclick=()=>{if(!lastAnswer)return notice('Primeiro consulte o CORE.');if(!('speechSynthesis' in window))return notice('Síntese de voz indisponível neste navegador.');const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.localService&&v.lang.toLowerCase().startsWith('pt'));if(!voice)return notice('Nenhuma voz local em português disponível.');speechSynthesis.cancel();const version=session;const utterance=new SpeechSynthesisUtterance(lastAnswer.slice(0,4000));activeSpeech=utterance;utterance.voice=voice;utterance.lang=voice.lang;utterance.onstart=()=>{if(version===session&&activeSpeech===utterance)state('speaking');};utterance.onend=utterance.onerror=()=>{if(version===session&&activeSpeech===utterance){activeSpeech=null;state('idle');}};speechSynthesis.speak(utterance);};
$('voice').onclick=()=>{const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)return notice('Reconhecimento de voz não disponível neste navegador.');if(!token)return notice('Conecte o CORE primeiro.');if(recognition)return notice('O microfone já está escutando.');const version=session;const current=new Recognition();recognition=current;current.lang='pt-BR';current.interimResults=false;current.onstart=()=>{if(version===session&&recognition===current)state('listening');};current.onresult=e=>{if(version===session&&recognition===current)$('prompt').value=e.results[0][0].transcript;};current.onend=()=>{if(version===session&&recognition===current){recognition=null;state('idle');}};current.onerror=e=>{if(version===session&&recognition===current){recognition=null;state('idle');notice('Microfone: '+e.error);}};try{current.start();}catch(error){recognition=null;state('idle');return notice('Microfone indisponível: '+error.message);}notice('O reconhecimento de voz do navegador pode usar um serviço externo; consulte as configurações de privacidade.');};
function clock(){$('clock').textContent=new Date().toLocaleTimeString('pt-BR',{hour12:false});}clock();setInterval(clock,1000);showAgents([]);
