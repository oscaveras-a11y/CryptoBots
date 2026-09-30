'use strict';

// Motor inicial de linguagem da VERIS: regras explícitas, base local e respostas
// controladas. Não chama provedores externos nem executa código recebido.
function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function gerarResposta({ pergunta, conhecimento = [], conhecimentoApp = [] } = {}) {
  const q = normalizar(pergunta).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (/^(oi|ola|bom dia|boa tarde|boa noite|opa|e ai|tudo bem)( veris)?$/.test(q)) {
    return 'Olá! Sou a VERIS. Posso conversar sobre os assuntos que já conheço, consultar minha base local 4X4 e do Trilha 4X4, e fazer cálculos simples. Ainda estou aprendendo e aviso quando não tiver informação suficiente.';
  }

  if (/^(obrigado|obrigada|valeu|agradecido|agradecida)( veris)?$/.test(q)) {
    return 'Por nada! Se quiser, pode me contar se a resposta ajudou ou fazer outra pergunta.';
  }

  if (/\b(quem e voce|quem e a veris|o que voce e|qual e seu nome)\b/.test(q)) {
    return 'Sou a VERIS, um assistente em desenvolvimento. Meu motor atual foi criado dentro do próprio projeto: identifica alguns tipos de pergunta, consulta conhecimentos locais e monta respostas controladas. Ainda não sou um modelo neural de conversa livre.';
  }

  if (/\b(o que voce sabe fazer|quais suas capacidades|o que voce pode fazer|como voce funciona)\b/.test(q)) {
    return 'Neste estágio, consigo fazer cálculos simples, consultar a base local confirmada de 4X4 e do aplicativo Trilha 4X4, responder a algumas perguntas gerais previstas no meu motor e reconhecer quando não encontrei conhecimento suficiente. Não consulto outra IA.';
  }

  if (/\b(inteligencia artificial|inteligencia artificial)\b/.test(q) && /\b(o que e|explique|defina|significa)\b/.test(q)) {
    return 'Inteligência artificial é um conjunto de métodos de computação que permite a um sistema executar tarefas como reconhecer padrões, classificar informações ou produzir respostas. O motor atual da VERIS é mais simples: usa regras e conhecimento local; ele ainda não aprendeu linguagem por treinamento neural.';
  }

  if (/\b(comecar a programar|comecar programar|aprender programacao|aprender a programar)\b/.test(q)) {
    return 'Para começar a programar, escolha um objetivo pequeno, como uma página ou uma calculadora. Aprenda variáveis, condições, repetições e funções; depois, pratique com exercícios curtos e revise cada erro. Posso ajudar com esses fundamentos, mas minha capacidade de gerar e verificar código ainda é limitada.';
  }

  if (conhecimentoApp.length) return conhecimentoApp.map(item => item.answer).join('\n\n');
  if (conhecimento.length) return conhecimento.map(item => item.answer).join('\n\n');

  return 'Ainda não tenho conhecimento suficiente para responder isso com segurança. Meu motor próprio está no início e cobre apenas algumas perguntas gerais, cálculos simples e a base local 4X4/Trilha 4X4. Você pode reformular a pergunta ou registrar esse tema para ampliar a VERIS.';
}

module.exports = { gerarResposta, normalizar };
