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
// Limited Portuguese/English intent resolver. Never invents edits or silently guesses a target.
export function interpretCodeInstruction(instruction, files=[]) {
  if(typeof instruction!=='string'||instruction.length>4000)throw new TypeError('invalid_instruction');
  validate(files);
  const text=instruction.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const wantsNewline=/(linha final|quebra de linha final|final newline|newline at end)/.test(text);
  const wantsWhitespace=/(espacos? (?:em branco )?(?:no fim|finais?)|trailing whitespace|remov(?:a|er) espacos?)/.test(text);
  if(wantsNewline&&wantsWhitespace)return {status:'ambiguous_intent',reason:'multiple_operations'};
  if(wantsNewline||wantsWhitespace) {
    const action=wantsNewline?'ensure-final-newline':'remove-trailing-whitespace';
    const mentioned=files.filter(f=>instruction.includes(f.path));
    if(mentioned.length>1)return {status:'ambiguous_intent',reason:'multiple_target_files'};
    return {status:'resolved',operation:action,options:mentioned.length?{paths:[mentioned[0].path]}:{},confidence:'rule_based'};
  }
  return {status:'unsupported_intent',reason:'explicit_operation_required'};
}
export function createNativeCodeEngine() {
  return async function generateChanges({ instruction, files, operation = null, options = {} } = {}) {
    validate(files);
    if (typeof instruction !== 'string' || instruction.length > 4000) throw new TypeError('invalid_instruction');
    // Operations are explicit and intentionally narrow; never infer unsafe edits from prose.
    const intent=operation||options.operation?null:interpretCodeInstruction(instruction,files);
    if(intent&&intent.status!=='resolved')throw new Error('native_engine_'+intent.status);
    const action = operation ?? options.operation ?? intent.operation;
    if(intent)options={...intent.options,...options};
    if (action === 'replace-literal') {
      const { path, from, to } = options;
      if (typeof path !== 'string' || typeof from !== 'string' || !from || typeof to !== 'string' || from.length > 10000 || to.length > 10000) throw new TypeError('invalid_replace_request');
      const file = files.find(f => f.path === path);
      if (!file) throw new Error('target_not_found');
      const occurrences = file.content.split(from).length - 1;
      if (occurrences !== 1) throw new Error('replace_requires_unique_match');
      return [change(file, file.content.replace(from,to))];
    }
    if (action === 'replace-many') {
      // Multiple exact replacements in one atomic proposal, never fuzzy or inferred.
      const replacements=options.replacements;
      if(!Array.isArray(replacements)||replacements.length<1||replacements.length>40)throw new TypeError('invalid_replacements');
      const grouped=new Map();
      for(const item of replacements){
        if(!item||typeof item.path!=='string'||typeof item.from!=='string'||!item.from||typeof item.to!=='string'||item.from.length>10000||item.to.length>10000)throw new TypeError('invalid_replacement');
        if(!files.some(f=>f.path===item.path))throw new Error('target_not_found');
        if(!grouped.has(item.path))grouped.set(item.path,[]);
        grouped.get(item.path).push(item);
      }
      if(grouped.size>20)throw new TypeError('too_many_changed_files');
      const changes=[];
      for(const [path,items] of grouped){
        const file=files.find(f=>f.path===path);
        const sources=new Set();
        let content=file.content;
        for(const item of items){
          if(sources.has(item.from))throw new Error('duplicate_replacement_source');
          sources.add(item.from);
          const occurrences=content.split(item.from).length-1;
          if(occurrences!==1)throw new Error('replace_requires_unique_match');
          content=content.replace(item.from,item.to);
        }
        if(content!==file.content)changes.push(change(file,content));
      }
      return changes;
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
