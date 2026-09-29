'use strict';

const fs = require('fs');
const path = require('path');

const KB_PATH = path.join(__dirname, '..', 'knowledge', 'offroad.json');
const STOP = new Set('a o os as um uma de da do das dos e em no na nos nas para por com sem que qual quais como se ao aos ou mais muito minha meu seu sua isso esta este estou voce veículo veiculo trilha'.split(' '));

let cache = { mtimeMs: 0, entries: [] };

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function tokens(texto) {
  return [...new Set(normalizar(texto).match(/[a-z0-9]{3,}/g) || [])].filter(t => !STOP.has(t));
}
function carregarBase() {
  const stat = fs.statSync(KB_PATH);
  if (cache.mtimeMs === stat.mtimeMs && cache.entries.length) return cache.entries;
  const dados = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
  const entries = Array.isArray(dados.entries) ? dados.entries.filter(e => e.status === 'CONFIRMADA') : [];
  cache = { mtimeMs: stat.mtimeMs, entries };
  return entries;
}
function buscarConhecimento(pergunta, { limite = 4, minimo = 0.12 } = {}) {
  const q = tokens(pergunta);
  if (!q.length) return [];
  return carregarBase().map(entry => {
    const top = new Set(tokens(entry.topic));
    const body = new Set(tokens(entry.answer));
    let pontos = 0;
    for (const t of q) {
      if (top.has(t)) pontos += 4;
      else if (body.has(t)) pontos += 1;
    }
    const score = pontos / Math.max(4, q.length * 4);
    return { id: entry.id, topic: entry.topic, answer: entry.answer, status: entry.status, score: Number(score.toFixed(3)) };
  }).filter(x => x.score >= minimo).sort((a,b) => b.score - a.score).slice(0, limite);
}
function formatarConhecimento(itens) {
  if (!itens.length) return 'Nenhum conhecimento interno suficientemente relacionado foi recuperado.';
  return itens.map((x,i) => '[KB' + (i+1) + '] ' + x.topic + '\n' + x.answer).join('\n\n');
}
function precisaPesquisaExterna(pergunta, itens) {
  const t = normalizar(pergunta);
  const atual = /\b(hoje|agora|atual|preco|onde comprar|clima|chuva|interdicao|estrada aberta|disponivel)\b/.test(t);
  const especificacao = /\b(torque|capacidade|litros|manual|codigo|pressao de combustivel|folga|medida|especificacao|temperatura exata)\b/.test(t);
  return atual || especificacao || !itens.length || (itens[0]?.score || 0) < 0.22;
}
module.exports = { carregarBase, buscarConhecimento, formatarConhecimento, precisaPesquisaExterna };
