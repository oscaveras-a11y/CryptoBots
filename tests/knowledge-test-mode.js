'use strict';
const assert = require('node:assert/strict');
const { buscarConhecimento } = require('../lib/ai-knowledge');
process.env.VERIS_ENABLE_TEST_KNOWLEDGE = 'true';
const result = buscarConhecimento('semieixo homocinética quebrada');
assert(result.some(e => e.id === 'offroad-015' && e.status === 'TESTE_NAO_VALIDADA'));
console.log('Modo de teste 4X4 aprovado');
