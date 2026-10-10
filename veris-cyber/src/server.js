import { createAccessGuard } from './access.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { auditSource } from './source-audit.js';
import { analyzeSecurity } from './engine.js';
import { planTask, reason } from './reasoning.js';
import { createReasoningSession, addEvidence, nextReasoningStep } from './native-reasoning.js';
import { orchestrate } from './orchestrator.js';
import { VerisCore } from '../core/src/index.js';
import { connectAgents } from '../core/src/connect-agents.js';
import { createLocalActionService } from '../agents/action/local-service.js';
import { createLocalCodeService } from '../agents/code/local-service.js';
import { loadLocalModelConfig } from './local-runtime.js';
import { createLocalModel } from './local-model.js';
import { createTorFetch } from './tor-fetch.js';
import { searchMultipleSources } from '../agents/research/multi-source.js';

export function createServer({ token = process.env.CYBER_API_TOKEN, codeConfig = null, networkMode='tor', languageModel=null } = {}) {
  const authorize = createAccessGuard(token);
  if(!['offline','restricted','tor'].includes(networkMode))throw new TypeError('invalid_network_mode');
  const localModel=languageModel ? createLocalModel(languageModel) : null;
  const researchRetriever=networkMode==='offline'?async()=>{throw new Error('external_research_disabled');}:networkMode==='tor'?(query,options)=>searchMultipleSources(query,{...options,fetchImpl:createTorFetch()}):searchMultipleSources;
  const actionService=codeConfig?createLocalActionService(codeConfig):null;
  const verisCore = connectAgents(new VerisCore({actionExecutor:actionService?.execute??null,actionAuthorizer:actionService?.authorize??null,codeService:codeConfig ? createLocalCodeService(codeConfig) : null,mindResponder:localModel,researchRetriever}));
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    const assets = {'/':['jarvis.html','text/html; charset=utf-8'],'/legacy':['index.html','text/html; charset=utf-8'],'/jarvis.js':['jarvis.js','text/javascript; charset=utf-8'],'/jarvis.css':['jarvis.css','text/css; charset=utf-8'],'/dashboard.js':['dashboard.js','text/javascript; charset=utf-8'],'/dashboard.css':['dashboard.css','text/css; charset=utf-8']};
    if(req.method==='GET' && Object.hasOwn(assets,req.url)){
      const [file,type]=assets[req.url];
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      return res.end(readFileSync(new URL('../public/'+file,import.meta.url)));
    }
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true, service: 'veris-cyber', mode: 'demo' });
    if (req.url.startsWith('/api/')) {
      const denied = authorize(req);
      if (denied) return reply(denied.status, {error: denied.error});
    }
    if (req.method === 'GET' && req.url === '/api/core/agents') return reply(200, { agents: verisCore.agents });
    if (req.method === 'GET' && req.url === '/api/core/dashboard') {
      const capabilities = verisCore.capabilities;
      return reply(200, {
        service: 'JARVIS',
        timestamp: new Date().toISOString(),
        agents: capabilities,
        queue: verisCore.queueStats,
        features: {
          voiceInput: capabilities.find(agent => agent.name === 'voice')?.transcriptionReady === true,
          voiceOutput: capabilities.find(agent => agent.name === 'voice')?.speechReady === true,
          vision: capabilities.find(agent => agent.name === 'vision')?.ready === true,
          localModel: !!localModel,
          code: !!codeConfig
        },
        system: { status: 'server_reachable', metricsAvailable: false }
      });
    }
    if(req.method==='GET' && req.url==='/api/privacy')return reply(200,{networkMode,localTextGeneration:!!localModel,externalResearch:networkMode!=='offline',researchTransport:networkMode==='tor'?'tor_required':networkMode,cloudTextGeneration:false,anonymous:false,note:networkMode==='tor'?'Tor obrigatório para pesquisas; sem conexão direta alternativa. Anonimato não é garantido.':'Pesquisas diretas revelam IP e consulta aos serviços utilizados.'});
    if(req.method==='GET' && req.url==='/api/core/capabilities')return reply(200,{agents:verisCore.capabilities});
    const agentRoute=/^\/api\/core\/agents\/(sense|mind|memory|planner|research|vision|voice|code|cyber|action|guard|verify)\/tasks$/.exec(req.url);
    if(req.method==='POST' && (agentRoute || req.url==='/api/cyber')){
      let body='';try{
        for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>20000)return reply(413,{error:'payload_too_large'});}
        const input=JSON.parse(body);if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{error:'invalid_agent_input'});
        if(agentRoute)return reply(202,verisCore.submitAgent(agentRoute[1],input));
        const {operation,project,permissionId,jobId,baselineId}=input;
        return reply(200,await verisCore.cyberOperation({operation,project,permissionId,jobId,baselineId}));
      }catch(error){return reply(error.message==='task_queue_full'?429:400,{error:error.message==='task_queue_full'?'task_queue_full':'invalid_agent_input'});}
    }
    if(req.method==='GET' && req.url==='/api/core/queue')return reply(200,verisCore.queueStats);
    const taskRoute=/^\/api\/core\/tasks\/([a-f0-9-]{36})(\/cancel)?$/.exec(req.url);
    if(taskRoute && req.method==='GET' && !taskRoute[2]){
      const task=verisCore.getTask(taskRoute[1]);return task?reply(200,task):reply(404,{error:'task_not_found'});
    }
    if(taskRoute && req.method==='POST' && taskRoute[2]){
      const cancelled=verisCore.cancelQueued(taskRoute[1]);return reply(cancelled?200:409,{cancelled,reason:cancelled?'queued_task_cancelled':'only_pending_tasks_can_be_cancelled'});
    }
    if(req.method==='POST' && req.url==='/api/core/tasks'){
      let body='';
      try{
        for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>20000)return reply(413,{error:'payload_too_large'});}
        const request=JSON.parse(body);if(typeof request.message!=='string'||!request.message.trim()||request.message.length>4000)return reply(400,{error:'message_required'});
        return reply(202,verisCore.submit(request));
      }catch(error){return reply(error.message==='task_queue_full'?429:400,{error:error.message==='task_queue_full'?'task_queue_full':'invalid_task_request'});}
    }
    if(req.method==='POST' && req.url==='/api/action'){
      let body='';try{
        for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>30000)return reply(413,{error:'payload_too_large'});}
        const input=JSON.parse(body);if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{error:'invalid_action_request'});
        const {tool,project,permissionId,path,content}=input;
        const response=await verisCore.invokeAgent('action',{instruction:'Ferramenta explícita do proprietário',data:{tool,project,permissionId,path,content}});
        return reply(200,response.result??{status:response.status,reason:response.reason??response.error,executed:false});
      }catch{return reply(400,{error:'invalid_action_request'});}
    }
    if (req.method === 'POST' && req.url === '/api/code') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 20000) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        // Roots, policies, proposal contents and approval objects never cross this boundary.
        const {operation,project,instruction,proposalId,approvalId,reviewReference,options,permissionId}=input;
        return reply(200,await verisCore.codeOperation({operation,project,instruction,proposalId,approvalId,reviewReference,options,permissionId}));
      } catch { return reply(400, { error: 'invalid_code_request' }); }
    }
    if (req.method === 'POST' && req.url === '/api/core/run') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 20000) return reply(413, { error: 'payload_too_large' });
        }
        const result = await verisCore.run(JSON.parse(body));
        return reply(200, result);
      } catch { return reply(400, { error: 'invalid_core_request' }); }
    }
    if (req.method === 'POST' && req.url === '/api/orchestrate') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 10000) return reply(413, { error: 'payload_too_large' });
        }
        return reply(200, orchestrate(JSON.parse(body)));
      } catch { return reply(400, { error: 'invalid_orchestration_request' }); }
    }
    if (req.method === 'POST' && req.url === '/api/reasoning') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 20000) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        if (input.action === 'start') {
          const session = createReasoningSession(input);
          return reply(200, { session, next: nextReasoningStep(session) });
        }
        if (input.action === 'evidence') {
          const session = addEvidence(input.session, input.evidence);
          return reply(200, { session, next: nextReasoningStep(session) });
        }
        return reply(400, { error: 'unknown_reasoning_action' });
      } catch { return reply(400, { error: 'invalid_reasoning_request' }); }
    }
    if (req.method === 'POST' && (req.url === '/api/assistant/chat' || req.url === '/api/assistant/plan')) {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 20000) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        if (req.url === '/api/assistant/plan') return reply(200, planTask(input.message));
        if(!localModel)return reply(200,{status:'local_model_not_configured',reply:'Configure o modelo local do MIND. Nenhum pedido foi enviado a um provedor externo.'});
        return reply(200, await localModel({ message: input.message }));
      } catch { return reply(400, { error: 'invalid_assistant_request' }); }
    }
    if (req.method === 'POST' && req.url === '/api/engine/analyze') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 250000) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        if (input.authorized !== true) return reply(403, { error: 'authorization_required' });
        return reply(200, analyzeSecurity(input));
      } catch { return reply(400, { error: 'invalid_analysis_request' }); }
    }
    if (req.method === 'POST' && req.url === '/api/source-audit') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 250000) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        if (input.authorized !== true) return reply(403, { error: 'authorization_required' });
        return reply(200, auditSource(input.source, input.filename));
      } catch (error) {
        return reply(400, { error: 'invalid_audit_request' });
      }
    }
    if (req.method === 'POST' && req.url === '/api/audits') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 8192) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        if (typeof input.target !== 'string' || !input.target.trim() || input.target.length > 300 || input.authorized !== true || typeof input.scope !== 'string' || !input.scope.trim() || input.scope.length > 1000) {
          return reply(400, { error: 'target_scope_and_authorization_required' });
        }
        return reply(201, { id: randomUUID(), status: 'draft', target: input.target.trim(), scope: input.scope.trim(), active_scan: false, persisted: false });
      } catch { return reply(400, { error: 'invalid_json' }); }
    }
    return reply(404, { error: 'not_found' });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.CYBER_PORT || 3200);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid CYBER_PORT');
  try {
    const token = process.env.CYBER_API_TOKEN || readFileSync(new URL('../config/api-token', import.meta.url), 'utf8').trim();
    const config=fileURLToPath(new URL('../config/projects.json',import.meta.url));
    const codeConfig=existsSync(config)?{config,authorityFile:fileURLToPath(new URL('../config/code-authority.json',import.meta.url)),workspaceStorage:fileURLToPath(new URL('../workspaces/',import.meta.url))}:null;
    const modelConfig=fileURLToPath(new URL('../config/local-model.json',import.meta.url));
    const languageModel=loadLocalModelConfig({file:modelConfig,credentialFile:fileURLToPath(new URL('../config/api-token',import.meta.url))});
    createServer({token,codeConfig,languageModel,networkMode:process.env.JARVIS_NETWORK_MODE||'tor'}).listen(port, '127.0.0.1', () => console.log('VERIS CYBER local API listening on 127.0.0.1:' + port));
  } catch {
    console.error('Verifique o acesso (npm run setup) e a configuração local de projetos antes de iniciar.');
    process.exitCode = 1;
  }
}
