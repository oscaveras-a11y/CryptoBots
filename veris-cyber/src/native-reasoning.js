import { randomUUID } from 'node:crypto';

// Native, deterministic reasoning cycle: observe -> hypothesize -> test -> revise.
// No external LLM, network operations, arbitrary code execution, or autonomous OS access.
const RULES = [
  { id: 'tls', match: /tls|https|certificado|ssl/i, hypothesis: 'A configuração TLS pode permitir conexões inseguras.', checks: ['Inspecionar opções TLS do código', 'Verificar validação de certificados em ambiente autorizado'], recommendation: 'Exigir validação de certificados e TLS atualizado.' },
  { id: 'auth', match: /login|senha|autentica|sess[aã]o|token|permiss[aã]o/i, hypothesis: 'O controle de acesso pode estar incorreto.', checks: ['Revisar autenticação e autorização', 'Executar testes de permissão com contas de laboratório'], recommendation: 'Aplicar menor privilégio e autorização por recurso.' },
  { id: 'injection', match: /sql|inje[cç][aã]o|query|banco de dados/i, hypothesis: 'Entradas não confiáveis podem chegar a consultas.', checks: ['Localizar concatenação de consultas', 'Verificar parametrização das consultas'], recommendation: 'Usar consultas parametrizadas e validação de entrada.' },
  { id: 'exposure', match: /porta|rede|servidor|internet|expos|firewall/i, hypothesis: 'Um serviço pode estar exposto além do necessário.', checks: ['Inventariar serviços e interfaces autorizados', 'Conferir firewall e autenticação'], recommendation: 'Restringir exposição, autenticar acessos e registrar eventos.' },
  { id: 'files', match: /arquivo|pasta|diret[oó]rio|mover|papel de parede|fundo de tela/i, hypothesis: 'A operação pode alterar o estado do sistema.', checks: ['Confirmar quais arquivos ou configurações são de teste', 'Preparar restauração antes de executar'], recommendation: 'Executar somente por agente autorizado, com confirmação e rollback.' }
];

export function createReasoningSession({ objective, scope, authorized } = {}) {
  if (typeof objective !== 'string' || !objective.trim() || objective.length > 4000) throw new TypeError('objective_required');
  if (typeof scope !== 'string' || !scope.trim() || scope.length > 1000 || authorized !== true) throw new TypeError('scope_and_authorization_required');
  const matched = RULES.filter(rule => rule.match.test(objective));
  const selected = matched.length ? matched : [{
    id: 'general', hypothesis: 'Ainda não existem evidências suficientes para concluir o objetivo.',
    checks: ['Definir critérios verificáveis de sucesso', 'Obter dados relevantes sem alterar sistemas'],
    recommendation: 'Coletar evidências antes de decidir qualquer ação.'
  }];
  return {
    id: randomUUID(), objective: objective.trim(), scope: scope.trim(), phase: 'hypothesis',
    hypotheses: selected.map(rule => ({
      id: rule.id, statement: rule.hypothesis, status: 'unverified', confidence: 0,
      checks: rule.checks, recommendation: rule.recommendation, evidence: []
    })),
    execution: 'none', decisions: [], limitations: ['Motor simbólico limitado a regras conhecidas.', 'Nenhuma ação externa é executada automaticamente.']
  };
}

export function addEvidence(session, { hypothesisId, observation, supports, source } = {}) {
  if (!session || !Array.isArray(session.hypotheses)) throw new TypeError('invalid_session');
  if (typeof observation !== 'string' || !observation.trim() || observation.length > 2000) throw new TypeError('invalid_observation');
  if (typeof source !== 'string' || !source.trim() || source.length > 300) throw new TypeError('source_required');
  if (typeof supports !== 'boolean') throw new TypeError('supports_must_be_boolean');
  const index = session.hypotheses.findIndex(h => h.id === hypothesisId);
  if (index < 0) throw new TypeError('unknown_hypothesis');
  const copy = structuredClone(session);
  const hypothesis = copy.hypotheses[index];
  hypothesis.evidence.push({ observation: observation.trim(), source: source.trim(), supports });
  const positive = hypothesis.evidence.filter(e => e.supports).length;
  const negative = hypothesis.evidence.length - positive;
  hypothesis.status = positive && negative ? 'conflicting' : positive ? 'supported' : 'not_supported';
  // Confidence represents internal evidence consistency, not probability of exploitation.
  hypothesis.confidence = Math.round(100 * Math.max(positive, negative) / hypothesis.evidence.length);
  copy.phase = 'review';
  copy.decisions.push({ hypothesisId, action: 'review_evidence', result: hypothesis.status });
  return copy;
}

export function nextReasoningStep(session) {
  if (!session || !Array.isArray(session.hypotheses)) throw new TypeError('invalid_session');
  const candidate = session.hypotheses.find(h => h.status === 'unverified' || h.status === 'conflicting');
  if (candidate) return { phase: 'investigate', hypothesisId: candidate.id, suggested_checks: candidate.checks, execution: 'requires_separate_authorized_tool' };
  return { phase: 'report', summary: session.hypotheses.map(h => ({ id: h.id, status: h.status, evidence_count: h.evidence.length })), execution: 'none' };
}
