// Evidence checks assess provenance and corroboration, not factual truth.
const validUrl = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
export function reviewResearch(evidence = []) {
  if (!Array.isArray(evidence)) throw new TypeError('invalid_evidence');
  const accepted = evidence.filter(s => s && typeof s.title === 'string' && s.title.trim() && typeof s.excerpt === 'string' && s.excerpt.trim() && validUrl(s.url));
  const domains = [...new Set(accepted.map(s => new URL(s.url).hostname.toLowerCase()))];
  return { checked: evidence.length, usable: accepted.length, domains, corroborated: domains.length >= 2, verified: false, status: accepted.length ? 'sources_reviewed' : 'insufficient_evidence', limitations: ['source_presence_does_not_establish_claim_truth'] };
}
export default function verify({ steps = [], research } = {}) {
  if (research) return reviewResearch(research.evidence ?? []);
  return { verified: steps.length > 0 && steps.every(s => s.result?.verified === true && s.result?.executed === true), checked: steps.length };
}
