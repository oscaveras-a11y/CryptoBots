// Local text conversation through MIND/CORE; no external retrieval or tools.
import {fileURLToPath} from 'node:url';
import {loadLocalModelConfig} from '../src/local-runtime.js';
import {createLocalModel} from '../src/local-model.js';
import {VerisCore} from '../core/src/index.js';
import {connectAgents} from '../core/src/connect-agents.js';
try{
 const message=process.argv.slice(2).join(' ').trim();
 if(!message||message.length>4000)throw new Error('usage');
 const config=loadLocalModelConfig({file:fileURLToPath(new URL('../config/local-model.json',import.meta.url)),credentialFile:fileURLToPath(new URL('../config/api-token',import.meta.url))});
 if(!config)throw new Error('not_configured');
 const core=connectAgents(new VerisCore({mindResponder:createLocalModel(config),researchRetriever:async()=>{throw new Error('external_research_disabled');}}));
 const response=await core.invokeAgent('mind',{message,intent:'conversation'});
 if(response.status!=='ok'||response.result.status!=='model_answer')throw new Error('model_unavailable');
 console.log(response.result.answer);
}catch{
 console.error('Conversa indisponível. Inicie npm run model:start e use npm run chat -- "sua mensagem".');process.exitCode=1;
}
