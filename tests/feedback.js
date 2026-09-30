'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veris-feedback-'));
process.env.VERIS_FEEDBACK_FILE=path.join(dir,'feedback.json');
const feedback=require('../lib/feedback');
try {
  assert.throws(()=>feedback.submit({knowledge_id:'offroad-001',reason:'helpful'}),/Consentimento/);
  assert.throws(()=>feedback.submit({knowledge_id:'offroad-001',reason:'other',consent:true}),/Consentimento/);
  const result=feedback.submit({knowledge_id:'offroad-001',reason:'incorrect',consent:true,
    question:'Esta pergunta privada não pode ser armazenada'});
  assert.equal(result.status,'PENDING_REVIEW');
  const rows=feedback.list();
  assert.equal(rows.length,1);
  assert.equal(rows[0].knowledge_id,'offroad-001');
  assert(!JSON.stringify(rows).includes('pergunta privada'));
  assert(!rows[0].approved_at);
  console.log('Feedback: consentimento, privacidade e revisão pendente OK');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
