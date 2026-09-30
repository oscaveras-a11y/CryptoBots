'use strict';

const PREFIX = /^(?:(?:quanto\s+e|calcule|calcular|resolva)\s+|qual\s+e\s+o\s+resultado\s+de\s+)/;
const MAX_EXPRESSION_LENGTH = 120;
const MAX_TOKENS = 80;

function tokensDaExpressao(expression) {
  const tokens = [];
  const pattern = /\s*(?:(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%^])\s*/gy;
  let pos = 0;
  while (pos < expression.length) {
    pattern.lastIndex = pos;
    const match = pattern.exec(expression);
    if (!match || match[0].length === 0) return null;
    const token = match[0].trim();
    tokens.push(token);
    if (tokens.length > MAX_TOKENS) return null;
    pos = pattern.lastIndex;
  }
  return tokens;
}

function calcularPergunta(question) {
  if (typeof question !== 'string' || question.length > 2000) return null;

  let expression = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  expression = expression.replace(PREFIX, '');
  expression = expression
    .replace(/multiplicad[oa]\s+por|vezes/g, '*')
    .replace(/dividido\s+por|dividido/g, '/')
    .replace(/elevado\s+a/g, '^')
    .replace(/\bmais\b/g, '+')
    .replace(/\bmenos\b/g, '-')
    .replace(/([0-9)])\s*[x×]\s*(?=[0-9(])/g, '$1*')
    .replace(/([0-9]),([0-9])/g, '$1.$2')
    .replace(/\s*=\s*\?*\s*$/, '')
    .replace(/[?!.\s]+$/, '')
    .trim();

  if (expression.length > MAX_EXPRESSION_LENGTH || !/[+*/%^]/.test(expression) && !/\d\s*-/.test(expression)) return null;
  if (!/^[0-9.+*/%^()\s-]+$/.test(expression)) return null;

  const tokens = tokensDaExpressao(expression);
  if (!tokens?.length) return null;
  let index = 0;

  function finite(value) {
    if (!Number.isFinite(value)) throw new Error('non-finite');
    return value;
  }

  function primary() {
    const token = tokens[index++];
    if (token === '(') {
      const value = addition();
      if (tokens[index++] !== ')') throw new Error('parenthesis');
      return value;
    }
    if (token === undefined || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('number');
    return finite(Number(token));
  }

  function power() {
    const base = primary();
    if (tokens[index] !== '^') return base;
    index++;
    const exponent = unary();
    if (Math.abs(exponent) > 100) throw new Error('exponent');
    return finite(base ** exponent);
  }

  function unary() {
    if (tokens[index] === '+') {
      index++;
      return unary();
    }
    if (tokens[index] === '-') {
      index++;
      return -unary();
    }
    return power();
  }

  function multiplication() {
    let value = unary();
    while (['*', '/', '%'].includes(tokens[index])) {
      const operator = tokens[index++];
      const right = unary();
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('division-by-zero');
      if (operator === '*') value *= right;
      else if (operator === '/') value /= right;
      else value %= right;
      value = finite(value);
    }
    return value;
  }

  function addition() {
    let value = multiplication();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++];
      const right = multiplication();
      value = finite(operator === '+' ? value + right : value - right);
    }
    return value;
  }

  try {
    const value = addition();
    if (index !== tokens.length) return null;
    const displayExpression = expression.replace(/([+\-*/%^])/g, ' $1 ').replace(/\s+/g, ' ').trim();
    return { expression: displayExpression, value: Number(value.toPrecision(12)) };
  } catch {
    return null;
  }
}

module.exports = { calcularPergunta };
