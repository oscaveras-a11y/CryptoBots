'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veris-business-'));
const file=path.join(dir,'businesses.json');
fs.writeFileSync(file,JSON.stringify({businesses:[
 {id:'loja-a',enabled:true,fallback_message:'Fale com a loja A',faq:[{id:'a1',question:'Qual o horário de atendimento?',keywords:['horario','atendimento'],answer:'Atendimento das 9 às 18.',approved:true},{id:'a2',question:'Qual o preço?',answer:'R$ 10',approved:false}]},
 {id:'loja-b',enabled:true,fallback_message:'Fale com a loja B',faq:[{id:'b1',question:'Qual o horário de atendimento?',answer:'Somente às tardes.',approved:true}]},
 {id:'loja-c',enabled:false,faq:[]}
]}));
process.env.VERIS_BUSINESS_FILE=file;
const {reply}=require('../lib/business-knowledge');
assert.equal(reply('loja-a','Qual o horário de atendimento?').answer,'Atendimento das 9 às 18.');
assert.equal(reply('loja-b','Qual o horário de atendimento?').answer,'Somente às tardes.');
assert.equal(reply('loja-a','Qual o preço?').needs_human,true);
assert.equal(reply('loja-c','Qual o horário?'),null);
assert.equal(reply('loja-b','produto indisponível').needs_human,true);
fs.rmSync(dir,{recursive:true,force:true});
console.log('Módulo comercial: isolamento, aprovação e fallback OK');
