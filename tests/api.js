'use strict';
const assert = require('node:assert/strict');
const { server } = require('../server');
(async () => {
  const key = 'test-key-with-more-than-32-characters-123';
  process.env.VERIS_API_KEY = key;
  // server.js lê a chave na importação: o teste deve definir a chave antes de carregar o módulo.
})().catch(e=>{ console.error(e);process.exitCode=1; });
