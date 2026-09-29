'use strict';

const SCOPE = /\b(4x4|off[ -]?road|trilha|rota|gps|navega|ve[ií]culo|carro|motor|c[aâ]mbio|diferencial|pneu|guincho|atol|recupera|sos|seguran[cç]a|mec[aâ]nic|prepara|suspens|jeep|s10|troller|suzuki|toyota|mitsubishi|ford|chevrolet|app|grupo|passeio|embreagem|freio|inje[cç][aã]o|bateria|alternador|radiador|temperatura|dire[cç][aã]o|eixo|rolamento|homocin[eé]tica)\b/i;
const GREETING = /^(oi|ol[aá]|opa|bom dia|boa tarde|boa noite|e a[ií]|fala|ajuda|socorro)[!.?\s]*$/i;
const SECRET_VALUE = /(sk-[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9]{20,}|bearer\s+[a-z0-9._~+\/-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*[^\s]{8,}|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/i;
const INJECTION = /(ignore|ignorar|desconsidere|esque[cç]a|substitua|revele|mostre|exiba|imprima|repita|bypass|contorne|finja|simule|roleplay|jailbreak|nova fun[cç][aã]o|a partir de agora|sem restri[cç][oõ]es)[\s\S]{0,180}(instru[cç][oõ]es|prompt|sistema|system|regras|pol[ií]tica|segredo|token|chave|prote[cç][aã]o|restri[cç][oõ]es|filtro)/i;
const INTERNAL = /(system prompt|prompt do sistema|instru[cç][oõ]es internas|regras internas|developer message|mensagem do desenvolvedor|chain of thought|cadeia de pensamento)/i;
const TOOL_ALLOWLIST = new Set(['web_search']);

function normalizar(value,max=2000){
 return String(value??'').normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\s{3,}/g,'  ').trim().slice(0,max);
}
function formaDeteccao(value){
 return normalizar(value,5000).toLowerCase().replace(/[._*~`'"-]/g,'').replace(/\s+/g,' ');
}
function contemSegredo(value){return SECRET_VALUE.test(normalizar(value,5000));}
function contemInstrucaoHostil(value){const t=formaDeteccao(value);return INJECTION.test(t)||INTERNAL.test(t);}
function avaliarEntrada(value){
 const text=normalizar(value);
 if(!text)return {ok:false,code:'empty'};
 if(contemSegredo(text))return {ok:false,code:'sensitive'};
 if(contemInstrucaoHostil(text))return {ok:false,code:'prompt-injection'};
 if(!GREETING.test(text)&&!SCOPE.test(text))return {ok:false,code:'out-of-scope'};
 return {ok:true,text};
}
function sanitizarCampo(value,max=160){
 const text=normalizar(value,max);
 if(!text||contemSegredo(text)||contemInstrucaoHostil(text))return '';
 return text;
}
function sanitizarMemoria(items){
 if(!Array.isArray(items))return [];
 return items.slice(0,12).map(item=>{
   const obj=typeof item==='string'?{texto:item,categoria:'legacy'}:item||{};
   const texto=sanitizarCampo(obj.texto,400);
   const categoria=['preferencia','fato_usuario','pergunta'].includes(obj.categoria)?obj.categoria:'';
   return texto&&categoria?{texto,categoria}:null;
 }).filter(Boolean).slice(0,6);
}
function sanitizarFonte(item){
 const title=sanitizarCampo(item?.title,160);
 let content=sanitizarCampo(item?.content,900);
 let url='';
 try{const p=new URL(String(item?.url||''));if((p.protocol==='https:'||p.protocol==='http:')&&!p.username&&!p.password)url=p.toString().slice(0,800);}catch{}
 return {title,url,content};
}
function validarSaida(value){
 const text=normalizar(value,6000);
 if(!text)return {ok:false,code:'empty-output'};
 if(contemSegredo(text)||INTERNAL.test(formaDeteccao(text)))return {ok:false,code:'unsafe-output'};
 return {ok:true,text};
}
function autorizarFerramenta(nome){return TOOL_ALLOWLIST.has(String(nome||''));}
function construirContextoSeguro({usuario,veiculo,trailName,trailStatus,memoria=[]}={}){
 const data={
   usuario:sanitizarCampo(usuario?.name,80),
   veiculo:{
     type:sanitizarCampo(veiculo?.type,40),brand:sanitizarCampo(veiculo?.brand,50),
     model:sanitizarCampo(veiculo?.model,60),year:Number.isInteger(Number(veiculo?.year))?String(veiculo.year).slice(0,4):''
   },
   trilha:{name:sanitizarCampo(trailName,100),status:sanitizarCampo(trailStatus,40)},
   memoria:sanitizarMemoria(memoria)
 };
 return JSON.stringify(data);
}
module.exports={avaliarEntrada,contemSegredo,contemInstrucaoHostil,sanitizarCampo,sanitizarMemoria,sanitizarFonte,validarSaida,autorizarFerramenta,construirContextoSeguro};
