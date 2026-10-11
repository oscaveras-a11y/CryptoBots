import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeCodeEngine,interpretCodeInstruction} from '../agents/code/native-engine.js';
const files=[{path:'src/a.js',content:'const a=1;   \n'},{path:'src/b.js',content:'const b=2;'}];
test('CODE resolves Portuguese cleanup instruction and scopes the file',async()=>{
 const result=await createNativeCodeEngine()({instruction:'Remover espaços no fim em src/a.js',files});
 assert.equal(result.length,1);
 assert.equal(result[0].path,'src/a.js');
 assert.equal(result[0].content,'const a=1;\n');
});
test('CODE resolves missing final newline',async()=>{
 const result=await createNativeCodeEngine()({instruction:'Adicionar linha final em src/b.js',files});
 assert.equal(result.length,1);
 assert.equal(result[0].content,'const b=2;\n');
});
test('CODE declines unknown and conflicting requests',async()=>{
 assert.equal(interpretCodeInstruction('Crie uma IA universal',files).status,'unsupported_intent');
 assert.equal(interpretCodeInstruction('Remover espaços no fim e adicionar linha final',files).status,'ambiguous_intent');
 await assert.rejects(createNativeCodeEngine()({instruction:'Faça tudo sozinho',files}),/operation_not_supported/);
});
