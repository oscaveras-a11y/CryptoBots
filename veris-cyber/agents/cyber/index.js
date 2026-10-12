import { checkScope } from '../guard/index.js';

// Five non-invasive assessment stages. No scanning, exploitation or network access.
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const normalize = value => typeof value === 'string' ? value.trim() : '';
const MAX_FINDINGS = 100;
const MAX_TEXT = 500;

export function assessCyberEvidence(data = {}) {
  const decision = checkScope({ target: data.target, activity: data.activity, authorization: data.authorization });
  if (!decision.allowed) return { status: 'blocked', reason: decision.reason, executed: false, findings: [] };
  const raw = Array.isArray(data.evidence) ? data.evidence : [];
  if (raw.length > MAX_FINDINGS) return { status: 'blocked', reason: 'evidence_limit_exceeded', executed: false, findings: [] };
  const findings = raw.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('invalid_evidence');
    const title = normalize(item.title).slice(0, MAX_TEXT);
    const description = normalize(item.description).slice(0, MAX_TEXT);
    const severity = SEVERITIES.includes(item.severity) ? item.severity : 'info';
    const verified = item.verified === true && normalize(item.source).length > 0;
    return { id: 'finding-' + (index + 1), title, description, severity,
      source: normalize(item.source).slice(0, MAX_TEXT), verified,
      recommendation: normalize(item.recommendation).slice(0, MAX_TEXT) };
  });
  const technologies = [...new Set((Array.isArray(data.technologies) ? data.technologies : [])
    .filter(x => typeof x === 'string').map(x => x.slice(0, 80)))].slice(0, 30);
  const priority = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  const ranked = [...findings].sort((a, b) => Number(b.verified) - Number(a.verified) || priority[b.severity] - priority[a.severity]);
  const hypotheses = ranked.filter(f => !f.verified).map(f => ({
    findingId: f.id, hypothesis: f.title, validation: 'manual_review_required'
  }));
  const remediation = ranked.filter(f => f.verified).map(f => ({
    findingId: f.id, severity: f.severity, recommendation: f.recommendation || 'Review configuration and apply vendor guidance'
  }));
  return {
    status: 'assessment_ready', executed: false, verified: false,
    reconnaissance: { technologies, evidenceCount: findings.length, mode: 'supplied_evidence_only' },
    vulnerabilityAnalysis: { findings: ranked, verifiedCount: findings.filter(f => f.verified).length },
    hypotheses,
    labValidation: { status: 'requires_isolated_lab_and_separate_approval', executed: false },
    remediation,
    report: { target: data.target, activity: data.activity, findingCount: findings.length,
      verifiedCount: findings.filter(f => f.verified).length, findings: ranked }
  };
}

export default function cyber({ instruction = '', scope = '', data = {} } = {}, context = {}) {
  const decision = checkScope({ target: data?.target, activity: data?.activity, authorization: data?.authorization });
  if (!decision.allowed) return { status: 'blocked', reason: decision.reason, findings: [], executed: false };
  if (data?.assessmentMode === 'evidence') {
    try { return assessCyberEvidence(data); }
    catch { return { status: 'blocked', reason: 'invalid_evidence', findings: [], executed: false }; }
  }
  if (typeof context.cyberOperation === 'function') return context.cyberOperation(data);
  return { status: 'requires_scanner_and_execution_approval', instruction, scope, target: data.target, activity: data.activity, findings: [], executed: false };
}
