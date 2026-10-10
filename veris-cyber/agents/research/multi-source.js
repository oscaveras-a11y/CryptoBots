import { searchWikipedia } from './wikipedia.js';
import { searchOpenAlex } from './openalex.js';
export async function searchMultipleSources(query, options = {}) {
  const providers = [
    ['wikipedia', searchWikipedia],
    ['openalex', searchOpenAlex]
  ];
  const outcomes = await Promise.allSettled(providers.map(async ([provider, search]) => {
    const sources = await search(query, { ...options, limit: Math.min(5, options.limit ?? 5) });
    return sources.map(source => ({ ...source, provider }));
  }));
  if (options.signal?.aborted) throw new Error('research_aborted');
  const successes = outcomes.filter(result => result.status === 'fulfilled');
  if (!successes.length) throw new Error('all_research_providers_failed');
  const seen = new Set();
  return successes.flatMap(result => result.value).filter(source => {
    const key = source.url?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, Math.min(options.limit ?? 12, 12)));
}
