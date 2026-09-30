'use strict';
const crypto=require('node:crypto');
const {avaliarEntrada,validarSaida}=require('./ai-security');
const TTL=30*60*1000, MAX_SESSIONS=500, MAX_MESSAGES=12;
const sessions=new Map();
function validId(id){return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);}
function prune(){const now=Date.now();for(const [key,s] of sessions)if(s.updated+TTL<now)sessions.delete(key);while(sessions.size>MAX_SESSIONS)sessions.delete(sessions.keys().next().value);}
function get(id,scope){prune();if(!validId(id))return null;const s=sessions.get(scope+':'+id);return s?{id,messages:s.messages.map(m=>({...m}))}:null;}
function add(id,scope,question,answer){prune();if(!validId(id))id=crypto.randomUUID();const key=scope+':'+id;const s=sessions.get(key)||{messages:[],updated:0};const q=avaliarEntrada(question),a=validarSaida(answer);
if(!q.ok||!a.ok)return id;
s.messages.push({role:'user',content:q.text},{role:'assistant',content:a.text.slice(0,1800)});
s.messages=s.messages.slice(-MAX_MESSAGES);s.updated=Date.now();sessions.delete(key);sessions.set(key,s);prune();return id;}
function clear(id,scope){if(validId(id))sessions.delete(scope+':'+id);}
module.exports={get,add,clear,validId};
