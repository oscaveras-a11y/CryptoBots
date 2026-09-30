'use strict';
const assert = require('node:assert/strict');
const { gerarResposta, normalizar } = require('../lib/language-engine');

assert.equal(normalizar('Olá, VERIS!'), 'ola, veris!');
assert.match(gerarResposta({pergunta:'Oi, VERIS!'}), /Olá! Sou a VERIS/);
assert.match(gerarResposta({pergunta:'Quem é você?'}), /motor atual foi criado dentro do próprio projeto/);
assert.match(gerarResposta({pergunta:'Explique o que é inteligência artificial.'}), /ainda não aprendeu linguagem por treinamento neural/);
assert.match(gerarResposta({pergunta:'Como começar a programar?'}), /variáveis, condições, repetições e funções/);
assert.match(gerarResposta({pergunta:'O que é computação quântica?'}), /Ainda não tenho conhecimento suficiente/);
assert.equal(gerarResposta({
  pergunta:'Como cadastrar?',
  conhecimentoApp:[{answer:'Resposta vinda da documentação local.'}]
}), 'Resposta vinda da documentação local.');
assert.equal(gerarResposta({
  pergunta:'Pergunta qualquer',
  conhecimento:[{answer:'Resposta vinda da base confirmada.'}]
}), 'Resposta vinda da base confirmada.');
console.log('Motor de linguagem VERIS: intenções próprias, respostas controladas e incerteza explícita OK');
