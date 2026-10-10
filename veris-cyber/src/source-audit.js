// Heuristic, read-only checks for code supplied by an authorized owner.
// Findings are leads for human review, not confirmed exploits.
const RULES = [
  { id: 'JS-EVAL', severity: 'high', title: 'Dynamic code evaluation', pattern: /\b(?:eval|new\s+Function)\s*\(/g, advice: 'Avoid evaluating dynamic strings as code.' },
  { id: 'JS-EXEC', severity: 'high', title: 'Shell command execution', pattern: /\b(?:exec|execSync)\s*\(/g, advice: 'Avoid shell execution with untrusted input; prefer argument arrays.' },
  { id: 'JS-INSECURE-TLS', severity: 'critical', title: 'TLS certificate validation disabled', pattern: /rejectUnauthorized\s*:\s*false/g, advice: 'Enable TLS certificate verification.' },
  { id: 'JS-CORS', severity: 'medium', title: 'Wildcard CORS origin', pattern: /(?:Access-Control-Allow-Origin['"]?\s*[,=:]\s*['"]\*['"]|origin\s*:\s*['"]\*['"])/g, advice: 'Restrict cross-origin access to trusted origins.' },
  { id: 'JS-SECRET', severity: 'high', title: 'Possible hardcoded secret', pattern: /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{12,}['"]/gi, advice: 'Use environment variables or a secrets manager.' }
];

export function auditSource(source, filename = 'source.js') {
  if (typeof source !== 'string' || source.length > 200_000) throw new TypeError('Source must be a string up to 200000 characters');
  if (typeof filename !== 'string' || filename.length > 200) throw new TypeError('Invalid filename');
  const findings = [];
  for (const rule of RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of source.matchAll(regex)) {
      const line = source.slice(0, match.index).split('\n').length;
      findings.push({ rule_id: rule.id, severity: rule.severity, title: rule.title, filename, line, advice: rule.advice, confidence: 'heuristic' });
      if (findings.length >= 100) return { findings, truncated: true, scanned: true };
    }
  }
  return { findings: findings.sort((a,b) => a.line - b.line), truncated: false, scanned: true };
}
