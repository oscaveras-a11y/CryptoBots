import {createSqliteMemory} from './sqlite-store.js';
const sqlite=createSqliteMemory();
export async function storeVerified(question,answer,options={}){return sqlite.storeVerified(question,answer,options);}
export default async function memory({message='',data={}}={}){
 if(typeof message!=='string'||!message.trim()||message.length>4000)throw new TypeError('invalid_memory_query');
 const scope=typeof data?.memoryScope==='string'&&data.memoryScope.trim()?data.memoryScope:'default';
 return sqlite.recall(message,{scope});
}
export async function storeExperience(experience={}){return sqlite.storeExperience(experience);}
export async function findExperiences(query={}){return sqlite.findExperiences(query);}
export async function searchExperiences(query={}){return sqlite.searchExperiences(query);}
export async function memoryStatistics(query={}){return sqlite.memoryStatistics(query);}
