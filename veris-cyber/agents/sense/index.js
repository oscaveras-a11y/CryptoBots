// SENSE: deterministic, local Portuguese command understanding.
// Classification is advisory: the CORE/GUARD alone decides authorization.
const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clean = s => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const starts = (s, pattern) => new RegExp('^(?:' + pattern + ')(?:\\b|[\\s,!?])', 'u').test(s);
const ROUTES = [
  ['code', /\b(codigo|programa|programar|script|bug|repositorio|github|javascript|python|funcao|compilar|codex)\b/u],
  ['cyber', /\b(seguranca|vulnerabilidade|firewall|malware|auditoria|pentest|antivirus|porta aberta)\b/u],
  ['vision', /\b(imagem|foto|fotografia|print|captura de tela|video|visualizar)\b/u],
  ['voice', /\b(audio|voz|falar|microfone|transcrever|pronunciar)\b/u],
  ['research', /\b(pesquise|pesquisar|procure|buscar na internet|noticias|cotacao|preco atual)\b/u],
  ['action', /\b(abrir|fechar|mover|apagar|excluir|instalar|desinstalar|executar|reiniciar|desligar|alterar|salvar|enviar|criar arquivo)\b/u]
];
const QUESTION = /^(o que|quem|qual|quais|como|quando|onde|por que|porque|quanto|quantos|quantas|sera que|voce sabe|me diga|me explique|explique|pode explicar|consegue explicar|gostaria de saber)\b/u;
const COMMAND = /^(continue|continuar|prossiga|prosseguir|melhore|melhorar|otimize|otimizar|crie|criar|faca|fazer|desenvolva|desenvolver|monte|montar|implemente|implementar|corrija|corrigir|atualize|atualizar|verifique|verificar|analise|analisar|teste|testar|pesquise|pesquisar|procure|procurar|abra|abrir|execute|executar|instale|instalar|remova|remover|apague|apagar|exclua|excluir|envie|enviar|mova|mover|salve|salvar|reinicie|reiniciar|configure|configurar|mostre|mostrar|liste|listar|leia|ler|transcreva|transcrever|traduza|traduzir|resuma|resumir|me ajude|preciso que|quero que|vamos)\b/u;
const GREETING = /^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|tudo bem|obrigado|obrigada|valeu|ate logo)[!?.\s]*$/u;
const DANGER = /\b(apagar|apague|excluir|exclua|formatar|formate|desligar|desligue|reiniciar|reinicie|transferir|transfira|comprar|compre|pagar|pague|publicar|publique|enviar|envie|instalar|instale|executar|execute)\b/u;
export function analyzeSense(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('invalid_sense_input');
  const { message, data = {} } = input;
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new TypeError('message_required');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('invalid_sense_data');
  const text = clean(message);
  const normalized = fold(text);
  const question = QUESTION.test(normalized) || /\?\s*$/.test(text);
  const command = COMMAND.test(normalized);
  const greeting = GREETING.test(normalized);
  const negated = /\b(nao|nunca|jamais|sem)\s+(?:quero|preciso|deve|faca|execute|apague|exclua|instale|envie)\b/u.test(normalized);
  const quotedAction = /^(?:como|o que|por que|porque|qual|quais)\b/u.test(normalized);
  const isQuestion = question || quotedAction;
  // Questions about an action are not requests to perform that action.
  const intent = greeting ? 'conversation' : negated ? 'conversation' : isQuestion && !command ? 'question' : command ? 'task' : 'conversation';
  const domains = ROUTES.filter(([, regex]) => regex.test(normalized)).map(([name]) => name);
  if (data.image && !domains.includes('vision')) domains.push('vision');
  if (data.audio && !domains.includes('voice')) domains.push('voice');
  const requestedAgent = domains[0] ?? (intent === 'question' ? 'mind' : intent === 'task' ? 'planner' : 'mind');
  const ambiguous = intent === 'conversation' && !greeting && !negated;
  return {
    intent, text, normalized, language: 'pt-BR',
    domains, requestedAgent, requiresClarification: ambiguous,
    riskHint: intent === 'task' && DANGER.test(normalized) ? 'potential_state_change' : 'none',
    // Never a permission decision or proof of identity.
    authorized: false, confidence: greeting || question || command ? 'rule_match' : 'uncertain',
    capabilities: { audioTranscription: false, speakerRecognition: false, imageUnderstanding: false }
  };
}
export default analyzeSense;
