import { createStateStore } from './state-store.js';

export function createInteractionMemory() {
  const store = createStateStore({ namespace: 'interaction-history' });
  return {
    append(entry) {
      return store.update({ sessions: {} }, state => {
        const key = JSON.stringify([entry.scope, entry.sessionId]);
        const history = state.sessions[key] || [];
        history.push({ role: entry.role, content: entry.content, at: new Date().toISOString() });
        state.sessions[key] = history.slice(-100);
        return state.sessions[key].at(-1);
      });
    },
    list(scope, sessionId) {
      const state = store.read({ sessions: {} });
      return state.sessions[JSON.stringify([scope, sessionId])] || [];
    },
    close() { store.close(); }
  };
}
