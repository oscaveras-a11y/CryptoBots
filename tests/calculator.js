'use strict';

const assert = require('node:assert/strict');
const { calcularPergunta } = require('../lib/calculator');

assert.deepEqual(calcularPergunta('Quanto é 125 × 48?'), { expression: '125 * 48', value: 6000 });
assert.equal(calcularPergunta('calcule (10 + 2) vezes 3').value, 36);
assert.equal(calcularPergunta('Quanto é 2,5 + 1,5?').value, 4);
assert.equal(calcularPergunta('quanto é 2 elevado a 3 elevado a 2').value, 512);
assert.equal(calcularPergunta('10 / 0'), null);
assert.equal(calcularPergunta('2 +'), null);
assert.equal(calcularPergunta('2 ** 8'), null);
assert.equal(calcularPergunta('quanto é 2 elevado a 1000'), null);
assert.equal(calcularPergunta('Como está o clima hoje?'), null);
assert.equal(calcularPergunta('Explique inteligência artificial.'), null);

console.log('Calculadora local: operações, precedência e entradas inválidas OK');
