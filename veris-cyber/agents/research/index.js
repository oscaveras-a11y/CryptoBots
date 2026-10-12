// RESEARCH evaluates supplied evidence; retrieval adapters must be injected by the CORE.
// It never invents citations, accesses the network implicitly, or treats an unsupported claim as verified.
const LIMIT = 12;
const isText = v => typeof v === 'string' && v.trim().length > 0;
const clean = v => v.trim().slice(0, 4000);
const isHttp = value => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol); }
  catch { return false; }
};
export function assessSources(sources = []) {
  if (!Array.isArray(sources)) throw new TypeError('invalid_research_sources');
  return sources.slice(0, LIMIT).map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return { index, valid: false, reason: 'invalid_source' };
    const title = isText(source.title) ? clean(source.title) : '';
    const url = isText(source.url) && isHttp(source.url) ? source.url.trim() : null;
    const excerpt = isText(source.excerpt) ? clean(source.excerpt) : '';
    const accessedAt = isText(source.accessedAt) && !Number.isNaN(Date.parse(source.accessedAt)) ? source.accessedAt : null;
    const valid = Boolean(title && url && excerpt);
    return { index, title, url, excerpt, accessedAt, valid, reason: valid ? null : 'source_metadata_incomplete' };
  });
}
export default async function research({ instruction = '', message = '', data = {} } = {}, context = {}) {
  const query = instruction || message;
  if (!isText(query) || query.length > 4000) throw new TypeError('invalid_research_query');
  if (context.signal?.aborted) throw new Error('research_aborted');
  let supplied = Array.isArray(data?.sources) ? data.sources : [];
  // An adapter is a CORE-provided capability, not a permission to run arbitrary code.
  if (!supplied.length && typeof context.retrieve === 'function') {
    supplied = await context.retrieve(clean(query), { signal: context.signal, limit: LIMIT });
  }
  if (context.signal?.aborted) throw new Error('research_aborted');
  const sources = assessSources(supplied);
  const validSources = sources.filter(s => s.valid);
  return {
    status: validSources.length ? 'evidence_collected' : 'requires_source',
    query: clean(query),
    sources,
    evidence: validSources.map(({ title, url, excerpt, accessedAt }) => ({ title, url, excerpt, accessedAt })),
    verified: false,
    requiresVerification: true,
    limitations: validSources.length ? ['source_content_not_independently_verified'] : ['no_usable_sources']
  };
}

// Rank supplied sources for investigation without equating relevance with truth.
export function rankResearchEvidence(query,sources=[]){
 if(!isText(query)||!Array.isArray(sources))throw new TypeError('invalid_research_ranking');
 const tokens=[...new Set(query.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]{3,}/gu)??[])].slice(0,30);
 return assessSources(sources).filter(s=>s.valid).map(s=>{
  const body=(s.title+' '+s.excerpt).toLocaleLowerCase('pt-BR');
  return {...s,relevance:tokens.length?tokens.filter(t=>body.includes(t)).length/tokens.length:0};
 }).sort((a,b)=>b.relevance-a.relevance||a.index-b.index);
}
