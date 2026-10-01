'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','public','legacy.html'),'utf8');
assert.match(html,/<span class="brand">VERIS-AI<\/span>/);
assert.match(html,/Sou a VERIS-AI/);
assert.match(html,/menuGeneral/);
assert.match(html,/Conhecimento 4X4/);
assert.match(html,/Matemática/);
assert.match(html,/Inteligência artificial/);
assert.match(html,/Programação/);
assert.doesNotMatch(html,/<span class="brand">VERIS 4X4<\/span>/);
console.log('Abertura geral VERIS-AI e menu de especialidades OK');

