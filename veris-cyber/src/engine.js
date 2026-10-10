import { auditSource } from './source-audit.js';

const WEIGHTS = Object.freeze({ critical: 10, high: 6, medium: 3, low: 1 });
const PRIORITY = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3 });

// Deterministic analysis engine. No network access, external AI or code execution.
export function analyzeSecurity({ source, filename = 'source.js', authorized, scope } = {}) {
  if (authorized !== true || typeof scope !== 'string' || !scope.trim() || scope.length > 1000) {
    throw new TypeError('Explicit authorization and nonempty scope are required');
  }
  const result = auditSource(source, filename);
  const findings = result.findings.map(f => ({ ...f, status: 'requires_review', evidence: { file: f.filename, line: f.line }, recommendation: f.advice }));
  findings.sort((a, b) => (PRIORITY[a.severity] ?? 4) - (PRIORITY[b.severity] ?? 4) || a.line - b.line);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  const riskScore = Math.min(100, findings.reduce((total, f) => total + (WEIGHTS[f.severity] ?? 0), 0));
  return {
    engine: 'veris-cyber-rules-v1',
    analysis_type: 'static_heuristic',
    target: filename,
    scope: scope.trim(),
    risk_score: riskScore,
    risk_level: riskScore >= 40 ? 'high' : riskScore >= 15 ? 'medium' : riskScore > 0 ? 'low' : 'no_findings',
    summary: { total: findings.length, by_severity: counts, truncated: result.truncated },
    findings,
    limitations: [
      'Heuristic matches are not confirmed vulnerabilities.',
      'Only supplied source text was analyzed; no target was contacted.',
      'No code was executed and no penetration test was performed.'
    ],
    next_steps: findings.length ? [
      'Review each finding and eliminate false positives.',
      'Confirm impact in an isolated, authorized test environment.',
      'Apply fixes and repeat the audit.'
    ] : ['Run complementary security tests; absence of findings does not prove security.']
  };
}
