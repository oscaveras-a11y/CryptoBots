import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Small DOM boundary double; all event and request logic runs from the shipped client.
function element(){return {value:'',textContent:'',disabled:false,children:[],listeners:{},classList:{add(){}},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},dispatch(type,event){for(const fn of this.listeners[type]??[])fn(event);this['on'+type]?.(event);}};}
test('panel sends entered credential once and clears it on disconnect',async()=>{
  const elements=new Map(),requests=[];
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
  const context=vm.createContext({document,AbortController,fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({agents:[{name:'code',connected:true}]})};}});
  vm.runInContext(await readFile(new URL('../public/dashboard.js',import.meta.url),'utf8'),context);
  document.getElementById('token').value='a'.repeat(64);
  document.getElementById('connect').dispatch('submit',{preventDefault(){},submitter:element()});
  await new Promise(r=>setImmediate(r));
  assert.equal(requests.length,1);
  assert.equal(requests[0].options.headers.Authorization,'Bearer '+'a'.repeat(64));
  assert.equal(document.getElementById('token').value,'');
  assert.equal(document.getElementById('agents').children[0].children[0].textContent,'CODE');
  document.getElementById('disconnect').onclick();
  assert.equal(document.getElementById('connection').textContent,'Desconectado');
  document.getElementById('inspect').onclick();await new Promise(r=>setImmediate(r));assert.equal(requests.length,1);
});

test('disconnect discards a pending response from the old session',async()=>{
  const elements=new Map();let resolveReply;
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
  const context=vm.createContext({document,AbortController,fetch:()=>new Promise(r=>{resolveReply=r;})});
  vm.runInContext(await readFile(new URL('../public/dashboard.js',import.meta.url),'utf8'),context);
  vm.runInContext("credential='a'.repeat(64)",context);
  document.getElementById('message').value='pedido privado';
  document.getElementById('chat').onsubmit({preventDefault(){},submitter:element()});
  document.getElementById('disconnect').onclick();
  resolveReply({ok:true,json:async()=>({answer:'PRIVATE ANSWER'})});
  await new Promise(r=>setImmediate(r));
  assert.equal(document.getElementById('answer').textContent,'Aguardando seu pedido.');
  assert.equal(vm.runInContext('lastAnswer',context),'');
});
