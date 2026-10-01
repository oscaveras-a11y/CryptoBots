'use strict';
(()=>{
 const canvas=document.getElementById('mediaCanvas'),ctx=canvas.getContext('2d'),status=document.getElementById('mediaStatus'),select=document.getElementById('mediaCampaign');
 let campaigns=[],image=null,audioFile=null,busy=false;
 function say(text){status.textContent=text;}
 function current(){const c=campaigns.find(c=>c.id===select.value);if(!c)throw Error('Crie e selecione uma campanha primeiro.');return c;}
 function wrap(text,x,y,maxWidth,size,color,maxLines=6){ctx.font='600 '+size+'px system-ui';ctx.fillStyle=color;const words=String(text).replace(/https:\/\/\S+/g,'').split(/\s+/);let line='',lines=[];for(const word of words){if(ctx.measureText(line+word+' ').width>maxWidth&&line){lines.push(line.trim());line=word+' ';}else line+=word+' ';}if(line.trim())lines.push(line.trim());if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].slice(0,-3)+'…';}for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*size*1.25);return y+lines.length*size*1.25;}
 function draw(t=0){if(!ctx)return;let c;try{c=current();}catch{c={content:{headline:'Sua próxima campanha',message:'Selecione uma campanha para preparar seu material.'},product_title:'VERIS-AI'};}
  ctx.fillStyle='#143c32';ctx.fillRect(0,0,1080,1920);
  const shift=Math.sin(t/3)*45;ctx.fillStyle='#2d5943';ctx.beginPath();ctx.arc(940+shift,220,390,0,Math.PI*2);ctx.fill();ctx.fillStyle='#395841';ctx.beginPath();ctx.arc(1030,1840,380,0,Math.PI*2);ctx.fill();
  ctx.font='700 28px system-ui';ctx.fillStyle='#d4e88a';ctx.fillText('PUBLICIDADE · LINK DE AFILIADO',78,100);
  const phase=t<5?0:t<11?1:2;const title=phase===0?c.content.headline:phase===1?c.product_title:'Confira as condições no link';
  wrap(title,78,215,920,74,'#ffffff',4);
  if(image){const area={x:78,y:635,w:924,h:740},scale=Math.min(area.w/image.width,area.h/image.height)*(1+Math.sin(t/4)*.025);const w=image.width*scale,h=image.height*scale;ctx.fillStyle='#f4f5ef';ctx.fillRect(area.x,area.y,area.w,area.h);ctx.save();ctx.beginPath();ctx.rect(area.x,area.y,area.w,area.h);ctx.clip();ctx.drawImage(image,area.x+(area.w-w)/2+shift*.15,area.y+(area.h-h)/2,w,h);ctx.restore();}
  else{ctx.font='900 330px system-ui';ctx.fillStyle='#d4e88a';ctx.save();ctx.translate(400+shift,1120);ctx.rotate(Math.sin(t/4)*.05);ctx.fillText('V',0,0);ctx.restore();}
  const call=phase===2?'Veja os detalhes antes de comprar.':'Conheça o produto e confira se combina com você.';
  wrap(call,78,1510,920,49,'#edf3de',3);wrap('Posso receber comissão pelas compras. Preço e disponibilidade no anúncio.',78,1750,900,28,'#d8e5c9',3);
  ctx.fillStyle='#eff5da';ctx.fillRect(78,1880,924*(Math.max(0,Math.min(t/15,1))),7);
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function update(list){const chosen=select.value;campaigns=list;select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Selecione uma campanha';select.append(blank);for(const c of list){const o=document.createElement('option');o.value=c.id;o.textContent=c.content.headline;select.append(o);}if(list.some(c=>c.id===chosen))select.value=chosen;else if(list.length)select.value=list[list.length-1].id;if(!busy)draw();}
 select.onchange=()=>{if(!busy)draw();};
 document.getElementById('renderCard').onclick=()=>{if(busy)return;try{current();draw();say('Prévia atualizada. Confira os textos antes de exportar.');}catch(e){say(e.message);}};
 document.getElementById('mediaImage').onchange=async e=>{if(busy)return;const file=e.target.files[0];if(!file){image=null;draw();return;}if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024){say('Use PNG, JPEG ou WebP de até 12 MB.');return;}const url=URL.createObjectURL(file),loaded=new Image();try{await new Promise((resolve,reject)=>{loaded.onload=resolve;loaded.onerror=reject;loaded.src=url;});image=loaded;draw();say('Imagem carregada somente neste navegador.');}catch{say('Não foi possível ler a imagem.');}finally{URL.revokeObjectURL(url);}};
 document.getElementById('mediaAudio').onchange=e=>{const file=e.target.files[0];if(file&&file.size>30*1024*1024){say('Áudio deve ter até 30 MB.');return;}audioFile=file||null;say(audioFile?'Áudio selecionado; ele será incluído no vídeo.':'Vídeo sem áudio.');};
 document.getElementById('downloadCard').onclick=()=>{if(busy)return;try{current();draw();canvas.toBlob(blob=>{if(blob){download(blob,'veris-campanha.png');say('Card PNG exportado em 1080 × 1920.');}else say('Não foi possível exportar o card.');},'image/png');}catch(e){say(e.message);}};
 document.getElementById('previewVoice').onclick=()=>{try{const c=current();if(!('speechSynthesis'in window))throw Error('Prévia de voz indisponível neste navegador.');speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(c.content.message.replace(/https:\/\/\S+/g,''));utterance.lang='pt-BR';speechSynthesis.speak(utterance);say('Prévia de voz. Esta voz não é gravada no arquivo de vídeo.');}catch(e){say(e.message);}};
 document.getElementById('stopVoice').onclick=()=>window.speechSynthesis?.cancel();
 document.getElementById('downloadVideo').onclick=async()=>{
  if(busy)return;let stream,audio,ac,audioUrl,raf,recorder,timer;const button=document.getElementById('downloadVideo');
  try{current();if(!canvas.captureStream||!window.MediaRecorder)throw Error('Este navegador não suporta exportação de vídeo. Use um navegador com MediaRecorder.');const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(v=>MediaRecorder.isTypeSupported(v));if(!mime)throw Error('Formato de vídeo indisponível neste navegador.');busy=true;button.disabled=true;document.getElementById('mediaImage').disabled=true;document.getElementById('mediaAudio').disabled=true;select.disabled=true;
   draw();stream=canvas.captureStream(24);
   if(audioFile){audioUrl=URL.createObjectURL(audioFile);audio=new Audio(audioUrl);const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Áudio no vídeo não é suportado neste navegador.');ac=new AC();const source=ac.createMediaElementSource(audio),dest=ac.createMediaStreamDestination();source.connect(dest);for(const track of dest.stream.getAudioTracks())stream.addTrack(track);await ac.resume();await audio.play();}
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});const chunks=[];
   const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;recorder.onerror=()=>reject(Error('A gravação falhou.'));});recorder.start(1000);const started=performance.now();
   const frame=()=>{const elapsed=(performance.now()-started)/1000;draw(Math.min(15,elapsed));say('Gravando '+Math.min(15,Math.floor(elapsed))+'/15s. Mantenha esta aba aberta.');if(elapsed<15)raf=requestAnimationFrame(frame);};frame();timer=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},15000);await done;const blob=new Blob(chunks,{type:mime});if(!blob.size)throw Error('O vídeo ficou vazio.');download(blob,'veris-campanha.'+(mime.includes('mp4')?'mp4':'webm'));say('Vídeo de 15 segundos exportado'+(audioFile?' com seu áudio.':', sem áudio.'));
  }catch(e){say(e.message||'Não foi possível exportar o vídeo.');}finally{if(timer)clearTimeout(timer);if(raf)cancelAnimationFrame(raf);if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop());if(audio)audio.pause();if(ac)await ac.close();if(audioUrl)URL.revokeObjectURL(audioUrl);busy=false;button.disabled=false;document.getElementById('mediaImage').disabled=false;document.getElementById('mediaAudio').disabled=false;select.disabled=false;draw();}
 };
 window.VerisMedia={update,clear(){campaigns=[];image=null;audioFile=null;select.replaceChildren();document.getElementById('mediaImage').value='';document.getElementById('mediaAudio').value='';window.speechSynthesis?.cancel();if(!busy)draw();}};
 draw();
})();
