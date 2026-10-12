// Local-only training manager. No shell, network binding or automatic training.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'../native-language');
const checkpoint=join(base,'checkpoints','jarvis-moe-prototype.pt');
const python=process.env.JARVIS_PYTHON || (process.platform==='win32'?join(base,'.venv','Scripts','python.exe'):join(base,'.venv','bin','python'));
let processRef=null, log=[], state='idle', exitCode=null;
const add=(message)=>{log.push(String(message).slice(0,1000));if(log.length>100)log.shift();};
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JARVIS — Treinamento</title><style>body{font:16px system-ui;background:#101014;color:#f5f0df;max-width:740px;margin:36px auto;padding:20px}h1{color:#d9b660}section{border:1px solid #796337;border-radius:12px;padding:20px}input{box-sizing:border-box;width:100%;padding:12px;margin:8px 0 16px;background:#24242b;color:white;border:1px solid #777;border-radius:6px}button{padding:12px;margin:5px;border:0;border-radius:6px;background:#d9b660;color:#171717;cursor:pointer}button:disabled{opacity:.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#222;padding:14px;max-height:360px;overflow:auto}</style><h1>JARVIS · Treinamento MoE</h1><section><p>Protótipo experimental em CPU, não é um modelo 7B treinado.</p><label>Arquivo de treinamento (caminho completo no computador)<input id="corpus" placeholder="C:\\JarvisDados\\treinamento.txt"></label><label>Etapas (1 a 5000)<input id="steps" type="number" min="1" max="5000" value="30"></label><button onclick="action('start')">Iniciar novo</button><button onclick="action('resume')">Retomar checkpoint</button><button onclick="action('stop')">Interromper</button><p id="status">Aguardando...</p><pre id="log"></pre></section><script>async function action(name){const body={corpus:document.getElementById('corpus').value,steps:Number(document.getElementById('steps').value)};const r=await fetch('/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)alert(data.error||'Falha');refresh()}async function refresh(){try{const d=await(await fetch('/api/status')).json();document.getElementById('status').textContent='Estado: '+d.state+' | checkpoint: '+(d.checkpoint?'disponível':'ausente');document.getElementById('log').textContent=d.log.join('\\n')}catch{}}refresh();setInterval(refresh,1500)</script></html>`;
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(req.method==='GET'&&path==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'"});return res.end(html);}
 if(req.method==='GET'&&path==='/api/status')return reply(res,200,{state,exitCode,checkpoint:existsSync(checkpoint),log});
 if(req.method!=='POST'||!['/api/start','/api/resume','/api/stop'].includes(path))return reply(res,404,{error:'Not found'});
 if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:3211')return reply(res,403,{error:'Origin denied'});
 if(path==='/api/stop'){if(!processRef)return reply(res,409,{error:'No active training'});processRef.kill();state='stopping';return reply(res,200,{state});}
 if(processRef)return reply(res,409,{error:'Training already running'});
 let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Request too large');}}catch{return reply(res,413,{error:'Invalid request'});}
 let body;try{body=JSON.parse(raw);}catch{return reply(res,400,{error:'Invalid JSON'});}
 if(typeof body.corpus!=='string'||!body.corpus.trim()||!Number.isInteger(body.steps)||body.steps<1||body.steps>5000)return reply(res,400,{error:'Invalid corpus or steps'});
 const corpus=resolve(body.corpus);
 if(!existsSync(corpus))return reply(res,400,{error:'Corpus not found'});
 if(!existsSync(python))return reply(res,400,{error:'Python environment missing; install dependencies first'});
 const resume=path==='/api/resume';
 if(resume&&!existsSync(checkpoint))return reply(res,400,{error:'No checkpoint to resume'});
 if(!resume&&existsSync(checkpoint))return reply(res,409,{error:'Checkpoint exists; choose Resume'});
 mkdirSync(dirname(checkpoint),{recursive:true});
 log=[];exitCode=null;state='running';
 const args=[join(base,'train.py'),'--corpus',corpus,'--steps',String(body.steps),'--output',checkpoint];
 if(resume)args.push('--resume');
 const child=spawn(python,args,{cwd:base,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
 processRef=child;add('Treinamento iniciado');
 child.stdout.on('data',b=>add(b.toString()));
 child.stderr.on('data',b=>add(b.toString()));
 child.on('error',e=>{add(e.message);state='error';processRef=null;});
 child.on('close',code=>{exitCode=code;state=code===0?'completed':'stopped_or_failed';processRef=null;add('Processo encerrado: '+code);});
 return reply(res,202,{state});
});
server.listen(3211,'127.0.0.1',()=>console.log('JARVIS training: http://127.0.0.1:3211'));
