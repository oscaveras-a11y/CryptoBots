import test from 'node:test';
import assert from 'node:assert/strict';
import sense from '../index.js';

test('identifies Portuguese questions with and without accents', () => {
  assert.equal(sense({message:'Como funciona o JARVIS?'}).intent,'question');
  assert.equal(sense({message:'O que é inteligência artificial'}).intent,'question');
});
test('routes coding tasks without granting permission', () => {
  const r=sense({message:'Corrija o bug no código do GitHub'});
  assert.equal(r.intent,'task'); assert.equal(r.requestedAgent,'code'); assert.equal(r.authorized,false);
});
test('handles greetings, uncertainty and negation', () => {
  assert.equal(sense({message:'Boa noite!'}).intent,'conversation');
  assert.equal(sense({message:'Não quero que apague nada'}).intent,'conversation');
  assert.equal(sense({message:'Talvez amanhã'}).requiresClarification,true);
});
test('does not confuse a question about deletion with execution', () => {
  const r=sense({message:'Como apagar um arquivo?'});
  assert.equal(r.intent,'question'); assert.equal(r.riskHint,'none');
});
test('uses supplied modality hints but does not claim to see or hear', () => {
  const r=sense({message:'Veja isso',data:{image:'uploaded'}});
  assert.ok(r.domains.includes('vision')); assert.equal(r.capabilities.imageUnderstanding,false);
});
test('rejects invalid input', () => {
  assert.throws(()=>sense({message:''}),/message_required/);
  assert.throws(()=>sense({message:'x'.repeat(4001)}),/message_required/);
});
