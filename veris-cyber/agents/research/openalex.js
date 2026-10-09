// OpenAlex public scholarly works search. No API key required for basic requests.
const ENDPOINT = 'https://api.openalex.org/works';
function abstractText(index) {
  if (!index || typeof index !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    if (Array.isArray(positions)) for (const position of positions) if (Number.isInteger(position) && position >= 0 && position < 500) words.push([position, word]);
  }
  return words.sort((a, b) => a[0] - b[0]).map(([, word]) => word).join(' ').slice(0, 1200);
}
export async function searchOpenAlex(query, { signal, limit = 5, fetchImpl = globalThis.fetch } = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('invalid_search_query');
  if (typeof fetchImpl !== 'function') throw new Error('fetch_unavailable');
  const url = ENDPOINT + '?' + new URLSearchParams({ search: query.slice(0, 300), 'per-page': String(Math.max(1, Math.min(limit, 10))), select: 'id,title,doi,publication_year,abstract_inverted_index,primary_location' });
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('openalex_http_' + response.status);
  const payload = await response.json();
  if (!Array.isArray(payload?.results)) throw new Error('invalid_openalex_response');
  const accessedAt = new Date().toISOString();
  return payload.results.map(work => ({
    title: String(work.title ?? '').slice(0, 400),
    url: typeof work.doi === 'string' && work.doi.startsWith('https://doi.org/') ? work.doi : String(work.id ?? ''),
    excerpt: abstractText(work.abstract_inverted_index),
    accessedAt,
    provider: 'openalex',
    publicationYear: work.publication_year
  })).filter(work => work.title && work.excerpt && /^https:\/\//.test(work.url));
}
