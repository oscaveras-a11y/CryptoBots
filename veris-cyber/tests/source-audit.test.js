import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSource } from '../src/source-audit.js';

test('finds suspicious patterns without exposing matched secrets', () => {
  const result = auditSource("const password = 'abcdefghijklmnop';\neval(userInput);\n", 'example.js');
  assert.deepEqual(result.findings.map(f => f.rule_id), ['JS-SECRET', 'JS-EVAL']);
  assert.equal(JSON.stringify(result).includes('abcdefghijklmnop'), false);
});

test('rejects oversized input', () => assert.throws(() => auditSource('x'.repeat(200001))));
test('clean code yields no findings', () => assert.equal(auditSource('const answer = 42;').findings.length, 0));
