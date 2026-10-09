// Public MediaWiki search adapter. Fixed host prevents user-controlled URL fetching.
const API = 'https://pt.wikipedia.org/w/api.php';
const stripMarkup = text => String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export async function searchWikipedia(query, { signal, limit = 5, fetchImpl = globalThis.fetch } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 4000) throw new TypeError('invalid_search_query');
  if (typeof fetchImpl !== 'function') throw new Error('fetch_unavailable');
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: query.slice(0, 300), srlimit: String(Math.min(10, Math.max(1, limit))), format: 'json', origin: '*' });
  const response = await fetchImpl(API + '?' + params, { method: 'GET', signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('wikipedia_http_' + response.status);
  const payload = await response.json();
  if (!Array.isArray(payload?.query?.search)) throw new Error('invalid_wikipedia_response');
  const accessedAt = new Date().toISOString();
  return payload.query.search.map(item => ({
    title: stripMarkup(item.title),
    url: 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(String(item.title).replace(/ /g, '_')),
    excerpt: stripMarkup(item.snippet),
    accessedAt
  })).filter(item => item.title && item.excerpt);
}
