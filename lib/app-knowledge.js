'use strict';
const fs = require('node:fs');
const path = require('node:path');
const FILE = path.join(__dirname,'..','knowledge','app-trilha4x4.json');
let cache={mtime:0,entries:[]};
const STOP=new Set('a o os as um uma de da do das dos e em no na nos nas para por com sem que qual quais como se ao aos ou mais muito minha meu seu sua isso esta este estou voce eu sobre quero saber funciona usar fazer'.split(' '));
function tokens(s){return [...new Set(String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{3,}/g)||[])].filter(x=>!STOP.has(x));}
function carregarApp(){const stat=fs.statSync(FILE);if(cache.mtime===stat.mtimeMs&&cache.entries.length)return cache.entries;const data=JSON.parse(fs.readFileSync(FILE,'utf8'));cache={mtime:stat.mtimeMs,entries:data.entries||[]};return cache.entries;}
function buscarApp(question,{limite=3,minimo=.22}={}){const q=tokens(question);if(!q.length)return [];return carregarApp().map(e=>{const topic=new Set(tokens(e.topic+' '+(e.keywords||[]).join(' ')));const answer=new Set(tokens(e.answer));let score=0;for(const t of q)score+=topic.has(t)?4:answer.has(t)?1:0;return {...e,score:Number((score/Math.max(4,q.length*4)).toFixed(3))};}).filter(x=>x.score>=minimo).sort((a,b)=>b.score-a.score).slice(0,limite);}
function perguntaSobreApp(question){const t=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /\b(app|aplicativo|trilha ?4x4|veris|cadastro|cadastrar|grupo|grupos|passeio|convite|notificac|instalar|iphone|android|pwa|offline|baixar mapa|criar trilha|rota planejada|meu 4x4)\b/.test(t);}
module.exports={carregarApp,buscarApp,perguntaSobreApp};
