import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalModel} from '../src/local-model.js';

const endpoint='http://127.0.0.1:3210/v1/chat/completions';
function streamResponse(chunks){
  let index=0;
  return {ok:true,body:new ReadableStream({
    pull(controller){
      if(index===chunks.length)return controller.close();
      controller.enqueue(new TextEncoder().encode(chunks[index++]));
    }
  })};
}

test('local model reads a streamed JSON response split across chunks',async()=>{
  const json=JSON.stringify({choices:[{message:{content:'Olá, tudo bem?'}}]});
  const model=createLocalModel({endpoint,fetchImpl:async()=>streamResponse([json.slice(0,20),json.slice(20,40),json.slice(40)])});
  const result=await model({message:'Olá'});
  assert.equal(result.status,'ok');
  assert.equal(result.reply,'Olá, tudo bem?');
});

test('local model rejects oversized streamed response without buffering all chunks',async()=>{
  let pulls=0;
  const response={ok:true,body:new ReadableStream({
    pull(controller){
      pulls++;
      controller.enqueue(new Uint8Array(50001));
      if(pulls>=4)controller.close();
    }
  })};
  const model=createLocalModel({endpoint,fetchImpl:async()=>response});
  const result=await model({message:'Olá'});
  assert.equal(result.status,'local_model_unavailable');
  assert.ok(pulls<4,'response should be rejected before reading all chunks');
});

test('local model rejects oversized text-only mock response',async()=>{
  const model=createLocalModel({endpoint,fetchImpl:async()=>({ok:true,text:async()=> 'á'.repeat(60000)})});
  const result=await model({message:'Olá'});
  assert.equal(result.status,'local_model_unavailable');
});
