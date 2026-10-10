import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const dbPath = resolve(process.env.VERIS_MEMORY_PATH || 'veris-cyber/data/memory.json');
const validLabel = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const validSource = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const MAX_EXPERIENCES = 1000;
const normalize = text => text.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
let queue = Promise.resolve();
const serialized = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
async function load() {
  try {
    const value = JSON.parse(await readFile(dbPath, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
async function save(value) {
  await mkdir(dirname(dbPath), { recursive: true });
  const temp = dbPath + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
    await rename(temp, dbPath);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}
export async function storeVerified(question, answer, { source = 'verified', scope = 'default' } = {}) {
  if (typeof question !== 'string' || typeof answer !== 'string' || !question.trim() || !answer.trim() || question.length > 4000 || answer.length > 8000) throw new TypeError('invalid_memory');
  if (!validLabel(scope) || !validSource(source)) throw new TypeError('invalid_scope_or_source');
  return serialized(async () => {
    const records = await load();
    records[JSON.stringify([scope, normalize(question)])] = { answer: answer.trim(), source, verified: true, savedAt: new Date().toISOString() };
    await save(records);
    return { stored: true, persistence: 'file', scope };
  });
}
export default async function memory({ message = '', data = {} } = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new TypeError('invalid_memory_query');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('invalid_memory_data');
  const scope = data.memoryScope === undefined ? 'default' : data.memoryScope;
  if (!validLabel(scope)) throw new TypeError('invalid_scope');
  return serialized(async () => {
    const records = await load();
    const item = records[JSON.stringify([scope, normalize(message)])];
    return { verified: item?.verified === true, answer: item?.verified === true ? item.answer : null, source: item?.source ?? null, savedAt: item?.savedAt ?? null, persistence: 'file' };
  });
}

export async function storeExperience({ scope, project, summary, outcome = 'unknown', verified = false, source = 'agent', taskId = null } = {}) {
  if (![scope, project].every(validLabel) || typeof summary !== 'string' || !summary.trim() || summary.length > 4000 || !validSource(source) || (taskId !== null && !validLabel(taskId))) throw new TypeError('invalid_experience');
  if (!['success', 'failure', 'unknown'].includes(outcome)) throw new TypeError('invalid_outcome');
  return serialized(async () => {
    const records = await load();
    const key = JSON.stringify(['experience', scope, project, randomUUID()]);
    records[key] = { summary: summary.trim(), outcome, verified: verified === true, source, taskId, savedAt: new Date().toISOString() };
    const experiences = Object.keys(records).filter(k => {
      try { return JSON.parse(k)[0] === 'experience'; } catch { return false; }
    });
    for (const oldKey of experiences.slice(0, -MAX_EXPERIENCES)) delete records[oldKey];
    await save(records);
    return { stored: true, key, verified: verified === true };
  });
}
export async function findExperiences({ scope, project, limit = 10 } = {}) {
  if (!validLabel(scope) || !validLabel(project) || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('invalid_experience_query');
  return serialized(async () => {
    const records = await load();
    return Object.entries(records).filter(([key]) => {
      try { const parts = JSON.parse(key); return parts[0] === 'experience' && parts[1] === scope && parts[2] === project; } catch { return false; }
    }).slice(-limit).map(([id, value]) => ({ id, ...value }));
  });
}
