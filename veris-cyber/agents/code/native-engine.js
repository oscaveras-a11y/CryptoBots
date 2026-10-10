// JARVIS native CODE engine v1. No LLM, network, shell, or filesystem writes.
// Deterministic, explicitly supported refactors. Unsupported requests fail closed.
import { createHash } from 'node:crypto';
const sha = s => createHash('sha256').update(s).digest('hex');
const JS = /\.(?:js|mjs|cjs|jsx|ts|tsx)$/i;
function validate(files) {
  if (!Array.isArray(files) || files.length > 200) throw new TypeError('invalid_files');
  for (const f of files) if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') throw new TypeError('invalid_file');
}
function change(f, content) { return {path:f.path,expectedSha256:sha(f.content),content}; }
export function createNativeCodeEngine() {
  return async function generateChanges({ instruction, files, operation = null, options = {} } = {}) {
    validate(files);
    if (typeof instruction !== 'string' || instruction.length > 4000) throw new TypeError('invalid_instruction');
    // Operations are explicit and intentionally narrow; never infer unsafe edits from prose.
    const action = operation ?? options.operation;
    if (action === 'replace-literal') {
      const { path, from, to } = options;
      if (typeof path !== 'string' || typeof from !== 'string' || !from || typeof to !== 'string' || from.length > 10000 || to.length > 10000) throw new TypeError('invalid_replace_request');
      const file = files.find(f => f.path === path);
      if (!file) throw new Error('target_not_found');
      const occurrences = file.content.split(from).length - 1;
      if (occurrences !== 1) throw new Error('replace_requires_unique_match');
      return [change(file, file.content.replace(from,to))];
    }
    if (action === 'remove-trailing-whitespace') {
      return files.filter(f => JS.test(f.path) && /[ \t]+$/m.test(f.content))
        .slice(0,20).map(f => change(f, f.content.replace(/[ \t]+$/gm,'')));
    }
    if (action === 'ensure-final-newline') {
      return files.filter(f => JS.test(f.path) && f.content.length > 0 && !f.content.endsWith('\n'))
        .slice(0,20).map(f => change(f, f.content + '\n'));
    }
    throw new Error('native_engine_operation_not_supported');
  };
}
