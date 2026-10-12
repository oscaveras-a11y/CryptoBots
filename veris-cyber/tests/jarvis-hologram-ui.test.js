import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root=new URL('../public/',import.meta.url);
test('hologram is the default and secondary controls remain accessible',()=>{
 const html=readFileSync(new URL('jarvis.html',root),'utf8');
 const css=readFileSync(new URL('jarvis.css',root),'utf8');
 const js=readFileSync(new URL('jarvis.js',root),'utf8');
 assert.match(html,/id="panel-toggle"/);
 assert.match(html,/id="core"/);
 assert.match(css,/body\{background:#000\}/);
 assert.match(css,/body\.panel-open/);
 assert.match(js,/panelToggle\.addEventListener/);
 assert.match(js,/const COUNT=6800/);
 assert.doesNotMatch(js,/ctx\.ellipse\(/);
 assert.match(js,/api\('\/api\/core\/tasks'/);
});
