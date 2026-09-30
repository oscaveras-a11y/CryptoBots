'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buscarConhecimento } = require('./lib/ai-knowledge');
const { buscarApp, perguntaSobreApp } = require('./lib/app-knowledge');
const measurements = require('./lib/measurements');
const feedback = require('./lib/feedback');
const business = require('./lib/business-knowledge');
const { avaliarEntrada, sanitizarCampo, contemSegredo, contemInstrucaoHostil } = require('./lib/ai-security');
const { calcularPergunta } = require('./lib/calculator');
const { gerarResposta } = require('./lib/language-engine');

const PORT = Number(process.env.PORT || 3100);
const PRODUCTION = process.env.NODE_ENV === 'production';
const UI_ENABLED = !PRODUCTION && process.env.VERIS_DISABLE_TEST_UI !== 'true';
if (PRODUCTION && process.env.VERIS_ENABLE_TEST_KNOWLEDGE === 'true') throw new Error('Base experimental proibida em produção');
const HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.VERIS_API_KEY || '';
const OWNER_KEY = process.env.VERIS_OWNER_API_KEY || '';
const OWNER_LIMIT = Math.min(600,Math.max(20,Number(process.env.VERIS_OWNER_RATE_LIMIT)||120));
const ORIGINS = new Set((process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
const buckets = new Map();
const MAX_BODY = 12 * 1024;
const WINDOW = 60_000;
const LIMIT = 20;

function json(res, status, data, extra = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}
function keyMatches(supplied, expected) {
  if (!expected || expected.length < 32 || !supplied) return false;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
function accessTier(req) {
  const header = req.headers.authorization || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (keyMatches(supplied, OWNER_KEY)) return 'owner';
  if (keyMatches(supplied, API_KEY)) return 'standard';
  return null;
}
function rateLimited(req, tier) {
  const key = tier + ':' + (req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  if (buckets.size > 2000) for (const [k,v] of buckets) if (v.until <= now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.until <= now) { buckets.set(key,{count:1,until:now+WINDOW}); return false; }
  bucket.count++;
  return bucket.count > (tier === 'owner' ? OWNER_LIMIT : LIMIT);
}
async function bodyJSON(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) { const err = new Error('Corpo excede 12 KB'); err.status = 413; throw err; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const err = new Error('JSON inválido'); err.status = 400; throw err; }
}
function languageReply(question, entries, context, appEntries = []) {
  const answer=gerarResposta({ pergunta:question, conhecimento:entries, conhecimentoApp:appEntries, contexto:context || {} });
  return answer.startsWith('Ainda não tenho conhecimento suficiente') ? null : answer;
}
const server = http.createServer(async (req,res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  }
  // Interface sem login para testes; a chave da API nunca é enviada ao navegador.
  if (req.url === '/' && req.method === 'GET' && !UI_ENABLED) return json(res,404,{error:'Interface de testes desabilitada'});
  if (req.url === '/' && req.method === 'GET') {
    const page=fs.readFileSync(path.join(__dirname,'public','index.html'));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
    return res.end(page);
  }
  if (req.url.startsWith('/ui/') && !UI_ENABLED) return json(res,404,{error:'Interface de testes desabilitada'});
  if (req.url.startsWith('/ui/')) {
    if (req.method!=='POST') return json(res,404,{error:'Rota não encontrada'});
    // A interface é aberta apenas para testes: manter a porta do Codespaces privada.
    if (!origin || new URL(origin).host!==req.headers.host) return json(res,403,{error:'Origem não permitida'});
    if(req.url==='/ui/chat'){
      try {
        const data=await bodyJSON(req);
        if(typeof data.question!=='string'||!data.question.trim()||data.question.length>2000)return json(res,400,{error:'Pergunta inválida'});
        // Reutiliza integralmente validação, base e modelo do endpoint autenticado.
        const port=req.socket.localPort;
        const response=await fetch('http://127.0.0.1:'+port+'/v1/chat',{method:'POST',headers:{Authorization:'Bearer '+API_KEY,'Content-Type':'application/json'},body:JSON.stringify({question:data.question}),signal:AbortSignal.timeout(32000)});
        const result=await response.json();
        return json(res,response.status,result);
      }catch{return json(res,502,{error:'A VERIS-AI não respondeu a tempo'});}
    }
    return json(res,404,{error:'Rota não encontrada'});
  }
  if (req.method === 'OPTIONS') return json(res,origin && ORIGINS.has(origin) ? 204 : 403,{});
  if (req.method === 'GET' && req.url === '/health') return json(res,200,{ok:true,service:'VERIS-AI',version:'0.1.0',model_configured:false,language_engine:'veris-native-v1'});
  // Piloto comercial privado: não disponibilizar no widget ou no chat público.
  if (req.url === '/v1/business/test' && req.method === 'POST') {
    if (accessTier(req)!=='owner') return json(res,403,{error:'Acesso exclusivo do proprietário'});
    if (rateLimited(req,'owner')) return json(res,429,{error:'Limite temporário excedido'});
    try {
      const data=await bodyJSON(req);
      const result=business.reply(data.business_id,data.question);
      return result?json(res,200,result):json(res,404,{error:'Loja não configurada ou piloto desabilitado'});
    } catch(err) {return json(res,err.status||500,{error:err.status?err.message:'Erro interno'});}
  }
  if (req.url === '/v1/feedback' && req.method === 'POST') {
    const tier=accessTier(req);
    if(!tier)return json(res,401,{error:'Não autorizado'});
    if(rateLimited(req,tier))return json(res,429,{error:'Limite temporário excedido'});
    try { const record=feedback.submit(await bodyJSON(req)); return json(res,201,{feedback:record}); }
    catch(err) {return json(res,err.status||500,{error:err.status?err.message:'Erro interno'});}
  }
  if (req.url === '/v1/feedback' && req.method === 'GET') {
    if(accessTier(req)!=='owner')return json(res,403,{error:'Acesso exclusivo do proprietário'});
    if(rateLimited(req,'owner'))return json(res,429,{error:'Limite temporário excedido'});
    return json(res,200,{feedback:feedback.list()});
  }
  if (req.url.startsWith('/v1/measurements/search?') && req.method === 'GET') {
    const tier=accessTier(req);
    if(!tier)return json(res,401,{error:'Não autorizado'});
    if(rateLimited(req,tier))return json(res,429,{error:'Limite temporário excedido'});
    const q=new URL(req.url,'http://localhost').searchParams.get('q')||'';
    return json(res,200,{measurements:measurements.search(q)});
  }
  if ((req.url === '/v1/measurements' || /^\/v1\/measurements\/[a-f0-9-]+\/approve$/.test(req.url)) && req.method === 'POST') {
    const tier=accessTier(req);
    if(tier!=='owner')return json(res,403,{error:'Acesso exclusivo do proprietário'});
    if(rateLimited(req,tier))return json(res,429,{error:'Limite temporário excedido'});
    try {
      if(req.url==='/v1/measurements'){
        const data=await bodyJSON(req);
        const record=measurements.create(data);
        return json(res,201,{measurement:record});
      }
      const id=req.url.split('/')[3];
      const record=measurements.approve(id);
      return record?json(res,200,{measurement:record}):json(res,404,{error:'Registro não encontrado'});
    }catch(err){return json(res,err.status||500,{error:err.status?err.message:'Erro interno'});}
  }
  if (req.url !== '/v1/chat' || req.method !== 'POST') return json(res,404,{error:'Rota não encontrada'});
  const tier = accessTier(req);
  if (!tier) return json(res,401,{error:'Não autorizado'});
  if (rateLimited(req,tier)) return json(res,429,{error:'Limite temporário excedido'});
  try {
    const data = await bodyJSON(req);
    if (!data || typeof data.question !== 'string' || !data.question.trim() || data.question.length > 2000) return json(res,400,{error:'question deve conter de 1 a 2000 caracteres'});
    if (data.context !== undefined && (typeof data.context !== 'object' || data.context === null || Array.isArray(data.context) || JSON.stringify(data.context).length > 2000)) return json(res,400,{error:'context inválido'});
    const safety = avaliarEntrada(data.question);
    if (!safety.ok) return json(res,400,{error:'Pergunta bloqueada pela validação de segurança',safety:safety.code});
    const question = safety.text;
    if (/\b(primeiros? socorros?|socorr\w*|engasg\w*|ferimentos?|hemorragia|reanimacao|parada cardiorrespiratoria|trauma|avc)\b/i.test(question.normalize('NFD').replace(/[\u0300-\u036f]/g,''))) {
      const aph = require('./knowledge/aph-socorrista-pendentes.json');
      const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const terms = normalized.match(/[a-z]{4,}/g) || [];
      const topics = aph.entries.filter(e => terms.some(t => e.topic.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(t))).slice(0,2);
      const refs = topics.flatMap(e => e.source_ids).filter((v,i,a) => a.indexOf(v)===i).map(id => aph.sources.find(s => s.id===id)).filter(Boolean);
      const overview = topics.length ? topics.map(e => e.topic+': '+e.summary).join('\n\n') : aph.entries.map(e => e.topic).join('; ');
      return json(res,200,{tier,answer:'Material educativo de APH (não é protocolo operacional aprovado).\n\n'+overview+'\n\nEm emergência no Brasil: SAMU 192 ou Bombeiros 193. Procedimentos dependem de capacitação, protocolo local e regulação médica.',mode:'educational-reference',module:'primeiros-socorros',knowledge:topics.map(e=>({id:e.id,topic:e.topic,status:e.status})),sources:refs.map(s=>({title:s.title,url:s.url})),app_knowledge:[],needs_review:true});
    }
    const calculation = calcularPergunta(question);
    if (calculation) {
      const expression = calculation.expression.replace(/\*/g,'×').replace(/\//g,'÷');
      return json(res,200,{tier,answer:'Cálculo local: '+expression+' = '+calculation.value,mode:'local-calculation',module:'veris-general',knowledge:[],app_knowledge:[],needs_review:false});
    }
    const rawContext = data.context || {};
    const context = {};
    for (const [k,v] of Object.entries(rawContext)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,35}$/.test(k)) continue;
      if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
      const safe = sanitizarCampo(v,160);
      if (safe && !contemSegredo(safe) && !contemInstrucaoHostil(safe)) context[k] = safe;
    }
    // Recuperação técnica antes da documentação do aplicativo para questões mecânicas ou de condução.
    const technicalIntent = /\b(atol\w*|desatol\w*|encalh\w*|guinch\w*|pneu\w*|calibr\w*|embreagem|diferencial|homocinetica|carda|motor|freio\w*)\b/i.test(question.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
    const entries = buscarConhecimento(question);
    const appEntries = !technicalIntent && perguntaSobreApp(question) ? buscarApp(question) : [];
    // Evita que a simples menção a um veículo seja interpretada como dúvida sobre o aplicativo.
    if (appEntries.length) entries.length = 0;
    // O motor VERIS responde com conhecimento local; conteúdo experimental continua fora dele.
    // Conhecimento experimental só é recuperado no modo privado de testes.
    const internal = appEntries.length ? appEntries : entries;
    const generalQuestion = !internal.length;
    const experimental = entries.some(e=>e.status==='TESTE_NAO_VALIDADA');
    // Quando o provedor está configurado, o modelo formula a resposta usando apenas
    // os registros recuperados. Conteúdo experimental continua fora dessa chamada.
    const generated = experimental ? null : languageReply(question,entries,context,appEntries);
    const answer = generated || (internal.length
      ? (experimental ? '[EM TESTE — RESPOSTA NÃO VALIDADA]\n\n' : '') + internal.map(e=>e.answer).join('\n\n')
      : 'Ainda não tenho conhecimento suficiente para responder isso com segurança.');
    return json(res,200,{tier,answer,mode:generated?(internal.length?'knowledge':'veris-native'):internal.length?'knowledge':'unavailable',module:appEntries.length?'trilha4x4-app':generalQuestion?'veris-general':'veris-4x4',knowledge:entries.map(e=>({id:e.id,topic:e.topic,status:e.status})),app_knowledge:appEntries.map(e=>({id:e.id,topic:e.topic})),needs_review:experimental||(generalQuestion&&!generated)});
  } catch (err) { return json(res,err.status || 500,{error:err.status ? err.message : 'Erro interno'}); }
});
if (require.main === module) {
  if (!API_KEY || API_KEY.length < 32 || API_KEY === 'SUBSTITUA_POR_CHAVE_ALEATORIA_LONGA') {
    console.error('Configure VERIS_API_KEY com pelo menos 32 caracteres antes de iniciar.');
    process.exit(1);
  }
  if (OWNER_KEY && (OWNER_KEY.length < 32 || OWNER_KEY === API_KEY)) { console.error('VERIS_OWNER_API_KEY deve ser diferente e ter ao menos 32 caracteres.'); process.exit(1); }
  server.listen(PORT,HOST,()=>console.log('VERIS-AI ouvindo em http://'+HOST+':'+PORT));
}
module.exports = { server };
