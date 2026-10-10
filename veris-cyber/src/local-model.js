// Text-only llama.cpp adapter. A local model is imported, not trained by JARVIS.
export function createLocalModel({endpoint,model='jarvis-local',fetchImpl=fetch,timeoutMs=60000}={}){
  let url;try{url=new URL(endpoint);}catch{throw new TypeError('local_endpoint_required');}
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/v1/chat/completions')throw new TypeError('local_endpoint_required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new TypeError('invalid_model_timeout');
  return async function respond({message}={}, {signal}={}){
    if(typeof message!=='string'||!message.trim()||message.length>4000)throw new TypeError('invalid_model_message');
    const controller=new AbortController(),abort=()=>controller.abort();
    if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeoutMs);
    try{
      const response=await fetchImpl(url.href,{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,temperature:0.2,max_tokens:192,messages:[{role:'system',content:'Você é JARVIS, assistente local. Responda em português, de forma breve. Não invente execução de ações ou fontes. Você só produz texto e não tem ferramentas. Se não souber, diga isso.'},{role:'user',content:message}]})});
      if(!response.ok)return {status:'local_model_error',reply:'O modelo local não respondeu corretamente.',execution:'none'};
      const text=await response.text();if(text.length>100000)throw new Error('model_response_too_large');
      const payload=JSON.parse(text),reply=payload?.choices?.[0]?.message?.content;
      if(typeof reply!=='string'||!reply.trim())throw new Error('empty_model_reply');
      return {status:'ok',reply:reply.slice(0,12000),model,execution:'text_only',verified:false,externalRequest:false};
    }catch{return {status:'local_model_unavailable',reply:'O modelo local está indisponível ou excedeu o tempo de resposta.',execution:'none'};}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  };
}
