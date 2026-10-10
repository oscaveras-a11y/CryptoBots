# VERIS CORE — motor central funcionando localmente

O CORE registra os 12 agentes: SENSE, MIND, MEMORY, PLANNER, RESEARCH, CODE, CYBER, ACTION, GUARD, VERIFY, VISION e VOICE. Escolhe os agentes apropriados ao pedido; não executa todos indiscriminadamente.

## Iniciar

No diretório `veris-cyber`, com Node.js 20 ou superior:

```text
node scripts/setup.js
node src/server.js
```

Abra `http://127.0.0.1:3200`. O painel solicita a credencial criada em `config/api-token`; ela fica em memória, sem localStorage. Ao desconectar, requisições pendentes são abortadas e respostas antigas descartadas. A página carrega sem revelar dados privados, e as rotas `/api/*` continuam autenticadas. O painel consulta o CORE, apresenta planos e conduz a revisão de propostas do CODE.

## Fluxo informativo

`POST /api/core/run`:

```json
{"message":"Corrija o codigo do meu programa","mode":"informational"}
```

SENSE classifica o pedido; MEMORY consulta o contexto; MIND sugere verificações; PLANNER seleciona o agente. O retorno `planned` contém `plan.steps`, `plan.suggestedChecks`, `answer` e `trace`, com `executed:false` e `verified:false`. Um pedido sem detalhes retorna `needs_plan_details`. Perguntas conhecidas continuam sendo respondidas pela memória; respostas gerais exigem fontes ou mecanismo de linguagem configurado.

## Fluxo CODE autorizado

Após configurar projetos e emitir permissão conforme [CODE-LOCAL.md](CODE-LOCAL.md):

```json
{
  "message":"Corrija o codigo do programa",
  "scope":"meu-projeto",
  "authorized":true,
  "data":{
    "requestedAgent":"code","operation":"propose",
    "project":"meu-projeto","permissionId":"ID_LOCAL",
    "options":{"operation":"ensure-final-newline"}
  }
}
```

GUARD consulta a autoridade local pelo adaptador confiável do CORE. O objeto `authorization` enviado pelo cliente não concede execução. PLANNER encaminha ao CODE, cujo serviço verifica os caminhos autorizados antes de ler e produzir a proposta. O CORE retorna `awaiting_approval` e `proposal`, sem executar código. Após aprovação local vinculada, `operation:"stage"` com `proposalId` e `approvalId` cria uma cópia e retorna `awaiting_review` com `reviewReference`. A revogação é relida antes de novas operações.

## Fila e acompanhamento

- `POST /api/core/tasks`: mesmo corpo de `/api/core/run`; HTTP 202 e ID do job.
- `GET /api/core/tasks/ID`: estado `queued`, `running`, `completed`, `failed` ou `cancelled`; o resultado interno distingue plano, bloqueio, proposta e revisão.
- `POST /api/core/tasks/ID/cancel`: cancela somente uma tarefa ainda pendente; tarefas em execução retornam HTTP 409.
- `GET /api/core/queue`: tarefas ativas, pendentes e limite de concorrência.

Padrões: três tarefas concorrentes, até cinquenta pendentes e cem resultados concluídos retidos. Histórico e fila ficam em memória e são perdidos ao reiniciar. Os agentes têm timeout cooperativo; não há isolamento de processos nem cancelamento forçado de uma operação de filesystem já iniciada.

## O que foi comprovado

Testes verificam registro dos 12 agentes, respostas conhecidas, planejamento real por MIND/PLANNER, fluxo GUARD/PLANNER/CODE, negação após revogação, staging e rollback em arquivos temporários, acompanhamento HTTP de jobs, retenção da fila, autenticação e descarte de resposta após desconexão.

## Integrações restantes

CORE funcional não significa que todos os adaptadores estão completos. ACTION não executa comandos arbitrários; testes de projetos exigem sandbox real; VISION ainda precisa de mecanismo visual; VOICE por Whisper/Piper precisa de binários e modelos. A leitura em voz alta no painel usa somente uma voz local em português quando disponível no navegador e não faz reconhecimento de microfone. Não há modelo neural próprio treinado. O painel foi validado por testes de rotas e lógica de eventos; a ferramenta de inspeção visual do navegador falhou ao iniciar, portanto não há validação visual real a declarar.
