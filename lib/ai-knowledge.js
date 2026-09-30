'use strict';

const fs = require('fs');
const path = require('path');

const KB_PATH = path.join(__dirname, '..', 'knowledge', 'offroad.json');
const STOP = new Set('a o os as um uma de da do das dos e em no na nos nas para por com sem que qual quais como se ao aos ou mais muito minha meu seu sua isso esta este estou voce veículo veiculo trilha'.split(' '));

let cache = { mtimeMs: 0, entries: [] };

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
const ALIASES = Object.freeze({
  encalhei:'atolamento', encalhou:'atolamento', encalhado:'atolamento',
  atolei:'atolamento', atolou:'atolamento', atolado:'atolamento',
  desatolar:'atolamento', pneus:'pneu', calibragem:'pressao',
  calibrar:'pressao', guinchar:'guincho', guinchando:'guincho',
  patinando:'patinacao'
});
function tokens(texto) {
  return [...new Set((normalizar(texto).match(/[a-z0-9]{3,}/g) || []).map(t => ALIASES[t] || t))].filter(t => !STOP.has(t));
}
function carregarBase() {
  const stat = fs.statSync(KB_PATH);
  if (cache.mtimeMs === stat.mtimeMs && cache.entries.length) return cache.entries;
  const dados = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
  const entries = Array.isArray(dados.entries) ? dados.entries.filter(e => e.status === 'CONFIRMADA' || e.status === 'ORIENTACAO_GERAL' || (process.env.VERIS_ENABLE_TEST_KNOWLEDGE === 'true' && e.status === 'TESTE_NAO_VALIDADA')) : [];
  cache = { mtimeMs: stat.mtimeMs, entries };
  return entries;
}
// Intenções distintas evitam confundir troca, calibragem e recuperação.
const INTENTS = [
  { test:/\b(troc(?:ar|a|o|ando)|substitu(?:ir|icao)|estepe|furad[oa])\b.*\bpneu\b|\bpneu\b.*\b(troc(?:ar|a|o|ando)|substitu(?:ir|icao)|estepe|furad[oa])\b/i, ids:['offroad-051'] },
  { test:/\b(calibr(?:ar|agem)|press[aã]o|psi|esvaziar)\b.*\bpneu\b|\bpneu\b.*\b(calibr(?:ar|agem)|press[aã]o|psi|esvaziar)\b/i, ids:['offroad-005'] },
  { test:/\b(atol\w*|desatol\w*)\b/i, ids:['offroad-001','offroad-011'] }
];
function buscarConhecimento(pergunta, { limite = 4, minimo = 0.12 } = {}) {
  const intent=INTENTS.find(x=>x.test.test(normalizar(pergunta)));
  if(intent) return intent.ids.map(id=>carregarBase().find(e=>e.id===id)).filter(Boolean).slice(0,limite).map(e=>({id:e.id,topic:e.topic,answer:e.answer,status:e.status,score:1}));
  const q=tokens(pergunta);
  if(!q.length)return [];
  const ranked=carregarBase().map(entry=>{
    const top=new Set(tokens(entry.topic));
    const body=new Set(tokens(entry.answer));
    let pontos=0;
    for(const t of q){if(top.has(t))pontos+=4;else if(body.has(t))pontos+=1}
    return {id:entry.id,topic:entry.topic,answer:entry.answer,status:entry.status,score:Number((pontos/Math.max(4,q.length*4)).toFixed(3))};
  }).filter(x=>x.score>=minimo).sort((a,b)=>b.score-a.score);
  // Na ausência de intenção explícita, não concatene respostas de temas diferentes.
  return ranked.slice(0,Math.min(limite,1));
}
function formatarConhecimento(itens) {
  if (!itens.length) return 'Nenhum conhecimento interno suficientemente relacionado foi recuperado.';
  return itens.map((x,i) => '[KB' + (i+1) + '] ' + (x.status === 'TESTE_NAO_VALIDADA' ? '[EM TESTE — NÃO VALIDADA] ' : '') + x.topic + '\n' + x.answer).join('\n\n');
}
function precisaPesquisaExterna(pergunta, itens) {
  const t = normalizar(pergunta);
  const atual = /\b(hoje|agora|atual|preco|onde comprar|clima|chuva|interdicao|estrada aberta|disponivel)\b/.test(t);
  const especificacao = /\b(torque|capacidade|litros|manual|codigo|pressao de combustivel|folga|medida|especificacao|temperatura exata)\b/.test(t);
  return atual || especificacao || !itens.length || (itens[0]?.score || 0) < 0.22;
}
module.exports = { carregarBase, buscarConhecimento, formatarConhecimento, precisaPesquisaExterna };
