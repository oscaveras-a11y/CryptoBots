// CODE SECURITY v1: passive, offline source auditing only.
// Never probes hosts, executes exploits, scans networks or modifies files.
const RULES = [
  {id:'js_dynamic_eval',severity:'high',extensions:/\.(?:js|mjs|cjs|ts|tsx|jsx)$/,regex:/\beval\s*\(/g,remediation:'Remove dynamic evaluation; use explicit parsing and allowlisted operations.'},
  {id:'js_shell_execution',severity:'high',extensions:/\.(?:js|mjs|cjs|ts|tsx|jsx)$/,regex:/\b(?:exec|execSync)\s*\(/g,remediation:'Avoid shell interpolation; prefer fixed-argument APIs and isolated execution.'},
  {id:'sql_string_interpolation',severity:'high',extensions:/\.(?:js|mjs|cjs|ts|tsx|jsx|py|sql)$/,regex:/\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^\n]*\$\{/gi,remediation:'Use parameterized SQL queries.'},
  {id:'hardcoded_secret_candidate',severity:'high',extensions:/\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|ya?ml)$/,regex:/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,remediation:'Use a secret manager or environment variables; rotate exposed credentials.'},
  {id:'insecure_tls_override',severity:'high',extensions:/\.(?:js|mjs|cjs|ts|tsx|jsx)$/,regex:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/g,remediation:'Keep TLS certificate validation enabled.'}
];
export function auditSource(files) {
  if (!Array.isArray(files) || files.length > 200) throw new TypeError('invalid_files');
  const findings=[];
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') throw new TypeError('invalid_file');
    if (Buffer.byteLength(file.content) > 300000) throw new TypeError('file_too_large');
    for (const rule of RULES) {
      if (!rule.extensions.test(file.path)) continue;
      rule.regex.lastIndex=0;
      let match;
      while ((match=rule.regex.exec(file.content)) !== null && findings.length < 100) {
        const line=file.content.slice(0,match.index).split('\n').length;
        findings.push({path:file.path,line,rule:rule.id,severity:rule.severity,confidence:'heuristic',remediation:rule.remediation,status:'requires_review'});
      }
    }
  }
  return {status:'audited',mode:'passive',executed:false,findings,limitations:['heuristic_findings_may_be_false_positives','no_active_pentest','no_runtime_verification']};
}
