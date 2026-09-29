'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const FILE=process.env.VERIS_MEASUREMENTS_FILE||path.join(__dirname,'..','data','measurements.json');
function load(){try{const x=JSON.parse(fs.readFileSync(FILE,'utf8'));return Array.isArray(x)?x:[]}catch(e){if(e.code==='ENOENT')return [];throw e;}}
function save(rows){fs.mkdirSync(path.dirname(FILE),{recursive:true,mode:0o700});const tmp=FILE+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows,null,2),{mode:0o600,flag:'wx'});fs.renameSync(tmp,FILE);}
function clean(x,max=160){return typeof x==='string'?x.trim().slice(0,max):'';}
function create(data){
 const vehicle=clean(data.vehicle),part=clean(data.part),partCode=clean(data.part_code,80),value=data.value,unit=clean(data.unit,12),method=clean(data.method,500),photo=clean(data.photo_reference,500);
 if(!vehicle||!part||!method||!['mm','cm','m','in'].includes(unit)||typeof value!=='number'||!Number.isFinite(value)||value<=0||value>100000)throw Object.assign(new Error('vehicle, part, value numérico positivo, unit e method são obrigatórios'),{status:400});
 if(photo && !/^https:\/\//i.test(photo) && !/^[a-z0-9_./-]+$/i.test(photo))throw Object.assign(new Error('photo_reference inválida'),{status:400});
 const record={id:crypto.randomUUID(),vehicle,part,part_code:partCode,value,unit,method,photo_reference:photo||null,status:'PENDING_REVIEW',visibility:'private',created_at:new Date().toISOString(),reviewed_at:null};
 const rows=load();rows.push(record);save(rows);return record;
}
function approve(id){const rows=load();const row=rows.find(x=>x.id===id);if(!row)return null;if(row.status!=='PENDING_REVIEW')throw Object.assign(new Error('Registro já revisado'),{status:409});row.status='VERIFIED';row.visibility='shared';row.reviewed_at=new Date().toISOString();save(rows);return row;}
function search(q){const terms=clean(q,200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\W+/).filter(x=>x.length>2);return load().filter(x=>x.status==='VERIFIED'&&x.visibility==='shared'&&terms.some(t=>(x.vehicle+' '+x.part+' '+x.part_code).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(t))).map(({id,vehicle,part,part_code,value,unit,method,photo_reference,status,reviewed_at})=>({id,vehicle,part,part_code,value,unit,method,photo_reference,status,reviewed_at})).slice(0,5);}
module.exports={create,approve,search,load};
