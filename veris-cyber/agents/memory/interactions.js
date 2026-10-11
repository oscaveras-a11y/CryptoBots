import { createStateStore } from './state-store.js';
const words = value => [...new Set(value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g) ?? [])];

export function createInteractionMemory() {
  const store = createStateStore({ namespace: 'interaction-history' });
  return {
    append(entry) {
      if (!entry || typeof entry.scope !== 'string' || !entry.scope.trim() || entry.scope.length > 160 || typeof entry.sessionId !== 'string' || !entry.sessionId.trim() || entry.sessionId.length > 160 || !['user', 'assistant'].includes(entry.role) || typeof entry.content !== 'string' || !entry.content.trim() || entry.content.length > 8000) throw new TypeError('invalid_interaction');
      return store.update({ sessions: {} }, state => {
        const key = JSON.stringify([entry.scope, entry.sessionId]);
        const history = state.sessions[key] || [];
        history.push({ role: entry.role, content: entry.content, at: new Date().toISOString() });
        state.sessions[key] = history.slice(-100);
        return state.sessions[key].at(-1);
      });
    },
    list(scope, sessionId) {
      if (typeof scope !== 'string' || !scope.trim() || typeof sessionId !== 'string' || !sessionId.trim()) throw new TypeError('invalid_interaction_query');
      const state = store.read({ sessions: {} });
      return state.sessions[JSON.stringify([scope, sessionId])] || [];
    },
    search(scope, sessionId, query, limit=10) {
      if(typeof query!=='string'||!query.trim()||query.length>500||!Number.isInteger(limit)||limit<1||limit>50)throw new TypeError('invalid_interaction_search');
      const terms=words(query);
      if(!terms.length)return [];
      return this.list(scope,sessionId).map((entry,index)=>({entry,index,score:words(entry.content).filter(word=>terms.includes(word)).length})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||b.index-a.index).slice(0,limit).map(({entry,score})=>({...entry,relevance:score}));
    },
    clear(scope, sessionId) {
      if (typeof scope !== 'string' || !scope.trim() || typeof sessionId !== 'string' || !sessionId.trim()) throw new TypeError('invalid_interaction_query');
      return store.update({ sessions: {} }, state => {
        const key = JSON.stringify([scope, sessionId]);
        const removed = state.sessions[key]?.length || 0;
        delete state.sessions[key];
        return { removed };
      });
    },
    close() { store.close(); }
  };
}
