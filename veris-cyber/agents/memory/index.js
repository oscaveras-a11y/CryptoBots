import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const dbPath = resolve(process.env.VERIS_MEMORY_PATH || 'veris-cyber/data/memory.json');
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
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, dbPath);
}
export async function storeVerified(question, answer, { source = 'verified', scope = 'default' } = {}) {
  if (typeof question !== 'string' || typeof answer !== 'string' || !question.trim() || !answer.trim() || question.length > 4000 || answer.length > 8000) throw new TypeError('invalid_memory');
  if (typeof scope !== 'string' || !scope.trim() || scope.length > 200) throw new TypeError('invalid_scope');
  return serialized(async () => {
    const records = await load();
    records[JSON.stringify([scope, normalize(question)])] = { answer: answer.trim(), source, verified: true, savedAt: new Date().toISOString() };
    await save(records);
    return { stored: true, persistence: 'file', scope };
  });
}
export default async function memory({ message = '', data = {} } = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new TypeError('invalid_memory_query');
  const scope = typeof data?.memoryScope === 'string' && data.memoryScope.trim() ? data.memoryScope : 'default';
  return serialized(async () => {
    const records = await load();
    const item = records[JSON.stringify([scope, normalize(message)])];
    return { verified: item?.verified === true, answer: item?.verified === true ? item.answer : null, source: item?.source ?? null, savedAt: item?.savedAt ?? null, persistence: 'file' };
  });
}
