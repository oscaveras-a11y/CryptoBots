'use strict';
const assert=require('node:assert/strict');
process.env.VERIS_API_KEY='ci-load-test-key-at-least-32-characters';
delete process.env.MODEL_API_KEY;
const {server}=require('../legacy-server');
async function batch(url,path,headers,total,concurrency,expected){
 const times=[],codes={};let next=0;
 await Promise.all(Array.from({length:concurrency},async()=>{while(next<total){next++;const start=performance.now();const r=await fetch(url+path,{method:path==='/health'?'GET':'POST',headers,body:path==='/health'?undefined:JSON.stringify({question:'Como agir em atolamento na lama?'})});times.push(performance.now()-start);codes[r.status]=(codes[r.status]||0)+1;await r.arrayBuffer();}}));
 times.sort((a,b)=>a-b);const p95=times[Math.ceil(times.length*.95)-1].toFixed(1);console.log(JSON.stringify({path,total,concurrency,codes,p95_ms:p95}));assert.equal(codes[expected],total);
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;try{await batch(url,'/health',{},200,10,200);await batch(url,'/v1/chat',{'Authorization':'Bearer '+process.env.VERIS_API_KEY,'Content-Type':'application/json'},15,5,200);}finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

