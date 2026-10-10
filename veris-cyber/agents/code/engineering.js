import { getCodeKnowledge } from './knowledge.js';
import { mapArchitecture, diagnoseFailures } from './intelligence.js';

export function engineeringBrief({ instruction = '', files = [], diagnostics = [], limit = 5 } = {}) {
  const knowledge = getCodeKnowledge({ topic: instruction, limit });
  const architecture = mapArchitecture(files);
  const debugging = diagnoseFailures(diagnostics);
  return {
    status: 'engineering_brief_ready',
    executed: false,
    verified: false,
    objective: instruction,
    architecture,
    diagnostics: debugging.failures,
    guidance: knowledge.lessons,
    checklist: [...new Set(knowledge.lessons.flatMap(item => item.checks))],
    workflow: ['inspect', 'design', 'propose', 'test', 'review', 'approve'],
    limitations: ['supplied_evidence_only', 'no_code_generation', 'no_tests_executed']
  };
}
