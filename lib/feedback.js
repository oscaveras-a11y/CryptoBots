'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FILE = process.env.VERIS_FEEDBACK_FILE || path.join(__dirname,'..','data','feedback.json');
const REASONS = new Set(['helpful','incorrect','incomplete','unsafe','outdated']);
function load() {
  try { const rows=JSON.parse(fs.readFileSync(FILE,'utf8')); return Array.isArray(rows)?rows:[]; }
  catch(e) { if(e.code==='ENOENT')return []; throw e; }
}
function submit(data) {
  if (!data || data.consent !== true || !REASONS.has(data.reason) ||
      typeof data.knowledge_id!=='string' || !/^(offroad|app|aph)-[0-9]{3}$/.test(data.knowledge_id))
    throw Object.assign(new Error('Consentimento, motivo e identificador de conhecimento válidos são obrigatórios'),{status:400});
  const rows=load();
  const record={id:crypto.randomUUID(),knowledge_id:data.knowledge_id,reason:data.reason,
    created_at:new Date().toISOString(),status:'PENDING_REVIEW'};
  rows.push(record);
  fs.mkdirSync(path.dirname(FILE),{recursive:true,mode:0o700});
  const temp=FILE+'.'+process.pid+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(rows,null,2),{mode:0o600,flag:'wx'});
  fs.renameSync(temp,FILE);
  return {id:record.id,status:record.status};
}
function list() {return load();}
module.exports={submit,list};
