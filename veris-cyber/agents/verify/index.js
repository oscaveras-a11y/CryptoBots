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

// Explicit task evidence assessment. Caller assertions alone never prove execution.
export function reviewTaskEvidence({checks=[],approval=null,reviewReference=null}={}){
 if(!Array.isArray(checks)||checks.length>100)throw new TypeError('invalid_task_checks');
 const usable=checks.filter(c=>c&&typeof c.name==='string'&&c.name.trim()&&['passed','failed','skipped'].includes(c.status));
 const failures=usable.filter(c=>c.status==='failed').map(c=>c.name);
 const testsPassed=usable.length>0&&usable.every(c=>c.status==='passed');
 const approved=approval?.confirmed===true&&typeof approval.proposalId==='string'&&approval.proposalId.length>0&&typeof reviewReference==='string'&&reviewReference.length>0;
 return {status:failures.length?'checks_failed':!testsPassed?'insufficient_test_evidence':!approved?'approval_required':'ready_for_trusted_confirmation',testsPassed,approved,verified:false,failures,checked:usable.length,limitations:['trusted_execution_and_approval_must_be_verified_by_core']};
}
