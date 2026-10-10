// Pure review gate: accepts evidence from an isolated test runner, never runs commands.
export function verifyCodeChange({ proposal, testResults = [], staticAnalysis = [], approval } = {}) {
  if (proposal?.status !== 'proposal_ready' || !Array.isArray(proposal.changes) || !proposal.changes.length) {
    return { status: 'invalid_proposal', verified: false };
  }
  if (!Array.isArray(testResults) || !Array.isArray(staticAnalysis) || testResults.length > 200 || staticAnalysis.length > 200) {
    return { status: 'invalid_evidence', verified: false };
  }
  const valid = record => record && typeof record === 'object' &&
    typeof record.name === 'string' && record.name.length > 0 && record.name.length <= 200 &&
    ['passed','failed','skipped'].includes(record.status) &&
    typeof record.source === 'string' && record.source.length > 0 && record.source.length <= 200;
  if (!testResults.every(valid) || !staticAnalysis.every(valid)) return { status: 'invalid_evidence', verified: false };
  const failed = [...testResults, ...staticAnalysis].filter(item => item.status === 'failed');
  const skipped = [...testResults, ...staticAnalysis].filter(item => item.status === 'skipped');
  const passed = [...testResults, ...staticAnalysis].filter(item => item.status === 'passed');
  const approved = approval?.confirmed === true && approval?.proposalId === proposal.proposalId;
  const verified = failed.length === 0 && skipped.length === 0 && testResults.some(item => item.status === 'passed') &&
    staticAnalysis.some(item => item.status === 'passed') && approved;
  return {
    status: verified ? 'review_passed' : 'review_required',
    verified,
    executed: false,
    checks: { passed: passed.length, failed: failed.length, skipped: skipped.length },
    failures: failed.map(item => ({ name: item.name, source: item.source })),
    missing: [
      ...(!testResults.some(item => item.status === 'passed') ? ['passing_tests'] : []),
      ...(!staticAnalysis.some(item => item.status === 'passed') ? ['passing_static_analysis'] : []),
      ...(!approved ? ['matching_approval'] : []),
      ...(skipped.length ? ['skipped_checks'] : [])
    ],
    limitations: ['supplied_evidence_only', 'trusted_runner_required', 'no_commands_executed']
  };
}
