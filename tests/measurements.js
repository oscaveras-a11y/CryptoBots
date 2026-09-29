'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veris-measurements-'));
process.env.VERIS_MEASUREMENTS_FILE=path.join(dir,'records.json');
const m=require('../lib/measurements');
try{
 assert.throws(()=>m.create({vehicle:'Commander',part:'Barra',value:'1112',unit:'mm',method:'ponta a ponta'}),/numérico/);
 const a=m.create({vehicle:'Jeep Commander 2025 2.0 diesel 4x4',part:'Barra estabilizadora traseira',part_code:'50148573',value:1112,unit:'mm',method:'Ponta a ponta em linha reta',photo_reference:'foto-medicao.jpg'});
 assert.equal(a.status,'PENDING_REVIEW');
 assert.equal(m.search('Commander').length,0);
 const b=m.approve(a.id);
 assert.equal(b.status,'VERIFIED');
 assert.equal(m.search('Commander')[0].value,1112);
 assert.equal(m.search('Commander')[0].method,'Ponta a ponta em linha reta');
 assert.throws(()=>m.approve(a.id),/revisado/);
 console.log('Medições: valor escrito obrigatório, foto como referência, privacidade e aprovação OK');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
