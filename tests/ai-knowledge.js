'use strict';
const assert = require('assert');
const { buscarConhecimento, formatarConhecimento, precisaPesquisaExterna } = require('../lib/ai-knowledge');

let r = buscarConhecimento('estou atolado na lama e as rodas estão patinando');
assert(r.length > 0);
assert(r.some(x => /Atolamento|tração|barro/i.test(x.topic)));
assert(formatarConhecimento(r).includes('[KB1]'));
assert.strictEqual(precisaPesquisaExterna('qual o torque exato do diferencial do meu carro?', r), true);
assert.strictEqual(precisaPesquisaExterna('como agir num atolamento na lama?', buscarConhecimento('como agir num atolamento na lama?')), false);
assert.strictEqual(buscarConhecimento('qual a melhor receita de bolo?').length, 0);
console.log('✅ Base de conhecimento IA 4X4 aprovada');
