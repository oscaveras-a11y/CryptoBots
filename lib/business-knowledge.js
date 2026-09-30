'use strict';
// Módulo comercial isolado: somente dados fornecidos pelo responsável.
const fs=require('node:fs');
const path=require('node:path');
const DEFAULT=path.join(__dirname,'..','knowledge','businesses.example.json');
const FILE=process.env.VERIS_BUSINESS_FILE || DEFAULT;
function load(){
  const data=JSON.parse(fs.readFileSync(FILE,'utf8'));
  if(!Array.isArray(data.businesses))throw Error('Configuração comercial inválida');
  return data.businesses;
}
function getBusiness(id){
  if(typeof id!=='string'||!/^[a-z0-9-]{2,40}$/.test(id))return null;
  return load().find(b=>b.id===id && b.enabled===true)||null;
}
function reply(id,question){
  const b=getBusiness(id);
  if(!b)return null;
  if(typeof question!=='string'||!question.trim()||question.length>1000)throw Object.assign(Error('Pergunta inválida'),{status:400});
  const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=new Set((normalized(question).match(/[a-z0-9]{3,}/g)||[]).filter(w=>!['como','qual','quero','para','vocês','voces','sobre','tem','uma','esse'].includes(w)));
  let best=null,score=0;
  for(const item of b.faq||[]){
    if(item.approved!==true)continue;
    const tokens=new Set((normalized(item.question+' '+(item.keywords||[]).join(' ')).match(/[a-z0-9]{3,}/g)||[]));
    const n=[...words].filter(w=>tokens.has(w)).length;
    if(n>score){best=item;score=n;}
  }
  if(best && score>0)return {business_id:b.id,answer:best.answer,source:'approved-business-faq',faq_id:best.id,needs_human:false};
  return {business_id:b.id,answer:b.fallback_message||'Não tenho essa informação confirmada. Consulte o atendimento da loja.',source:'business-fallback',needs_human:true};
}
module.exports={getBusiness,reply};
