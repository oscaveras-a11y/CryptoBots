# VERIS CYBER

Módulo independente de auditoria de segurança para sistemas sob autorização.

## Estado
Estrutura inicial e API local de demonstração. **Não executa invasões, varreduras de rede nem testes de carga.** A VERIS-AI original permanece inalterada.

## Executar
Requer Node.js 20 ou superior.

```bash
cd veris-cyber
npm test
npm start
```

API local em `http://127.0.0.1:3200` (configurável por `CYBER_PORT`).

- `GET /health`: status.
- `POST /api/audits`: registra uma auditoria demonstrativa, exigindo escopo e declaração de autorização; nenhum teste ativo é executado.

## Segurança e próximos passos
- Exigir autenticação e controle de acesso antes de exposição externa.
- Guardar autorização escrita, escopo e janela de testes antes de integrar scanners.
- Adicionar análise estática de código e relatórios com evidências.
- Nunca executar comandos sugeridos por um modelo de linguagem sem validação e aprovação.

## Motor de análise v1

`POST /api/engine/analyze` aceita JSON com `source` (código JavaScript), `filename`, `scope` e `authorized: true`. Retorna achados ordenados por severidade, pontuação heurística de risco, recomendações e limitações.

Exemplo de corpo:

```json
{
  "source": "eval(userInput);",
  "filename": "example.js",
  "scope": "código de laboratório próprio",
  "authorized": true
}
```

**Aviso:** o motor v1 é baseado em regras, não é um modelo de linguagem treinado nem uma IA generativa. A pontuação é heurística, não uma medida comprovada de explorabilidade. A API só escuta em localhost e ainda não possui autenticação de usuários; não exponha a porta na internet.
