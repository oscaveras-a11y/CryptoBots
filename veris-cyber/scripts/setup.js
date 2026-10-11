import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, lstat, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validApiToken } from '../src/access.js';
import { createSqliteMemory } from '../agents/memory/sqlite-store.js';
export async function setupAccess({ tokenFile = fileURLToPath(new URL('../config/api-token', import.meta.url)) } = {}) {
  await mkdir(dirname(tokenFile), {recursive:true, mode:0o700});
  try { await writeFile(tokenFile, randomBytes(32).toString('hex') + '\n', {flag:'wx', mode:0o600}); }
  catch (error) { if(error.code !== 'EEXIST') throw error; }
  const stat = await lstat(tokenFile);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('invalid_api_token_file');
  const token = (await readFile(tokenFile, 'utf8')).trim();
  if (!validApiToken(token)) throw new Error('invalid_existing_api_token');
  if (process.platform !== 'win32') await chmod(tokenFile, 0o600);
  const memory = createSqliteMemory();
  memory.close();
  return {configured:true,memory:'sqlite'};
}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  setupAccess().then(() => console.log('Acesso local configurado. A credencial foi salva em config/api-token e não será exibida.')).catch(() => {console.error('Não foi possível configurar o acesso local. Confira as permissões e o arquivo existente.');process.exitCode=1;});
}
