// Read-only project loader. The trusted host selects a project root; never accept a user-provided root.
import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, sep, join } from 'node:path';
const MAX_FILES = 200, MAX_BYTES = 300000;
const EXT = /\.(?:js|mjs|cjs|ts|tsx|jsx|py|html|css|json|sql|md|ya?ml)$/i;
const IGNORE = new Set(['.git','node_modules','dist','build','coverage','.next','.venv','venv']);
const SECRET = /^(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|p12)|secrets?\.(?:json|ya?ml))$/i;
export async function readProject(root, { maxFiles = MAX_FILES, maxBytes = MAX_BYTES, authorizePath = null, signal } = {}) {
  if (typeof root !== 'string' || !root.trim()) throw new TypeError('trusted_project_root_required');
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > MAX_FILES || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) throw new TypeError('invalid_limits');
  if (authorizePath !== null && typeof authorizePath !== 'function') throw new TypeError('invalid_path_authorizer');
  signal?.throwIfAborted();
  const canonical = await realpath(root);
  const files = [];
  let total = 0, truncated = false;
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      signal?.throwIfAborted();
      if (truncated) return;
      if (IGNORE.has(entry.name) || SECRET.test(entry.name) || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) continue;
      const actual = await realpath(path);
      const rel = relative(canonical, actual);
      if (!rel || rel === '..' || rel.startsWith('..' + sep) || resolve(canonical, rel) !== actual) continue;
      if (stat.isDirectory()) { await walk(actual); continue; }
      if (!stat.isFile() || !EXT.test(entry.name)) continue;
      const projectPath = rel.split(sep).join('/');
      if (authorizePath && await authorizePath(projectPath) !== true) continue;
      if (files.length >= maxFiles || total + stat.size > maxBytes) { truncated = true; return; }
      const content = await readFile(actual, {encoding:'utf8',signal});
      const size = Buffer.byteLength(content);
      if (total + size > maxBytes) { truncated = true; return; }
      total += size;
      files.push({ path: rel.split(sep).join('/'), content });
    }
  }
  await walk(canonical);
  return { files, truncated, totalBytes: total };
}
