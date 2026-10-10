import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSource } from './security.js';
test('security audit finds dangerous source patterns without execution', () => {
 const report=auditSource([{path:'src/app.js',content:'const a=1;\neval(userInput);\n'}]);
 assert.equal(report.executed,false);
 assert.equal(report.mode,'passive');
 assert.equal(report.findings[0].rule,'js_dynamic_eval');
 assert.equal(report.findings[0].line,2);
});
test('security audit does not treat findings as confirmed exploits', () => {
 const report=auditSource([{path:'src/app.js',content:'// eval(x) is dangerous'}]);
 assert.equal(report.findings[0].confidence,'heuristic');
 assert.equal(report.findings[0].status,'requires_review');
});
