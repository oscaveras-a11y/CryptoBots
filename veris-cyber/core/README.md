# VERIS CORE

Coordenador dos 12 agentes: SENSE, MIND, MEMORY, PLANNER, RESEARCH, CODE, CYBER, GUARD, VERIFY, ACTION, VISION e VOICE.

O CORE registra handlers, roteia solicitações, mantém histórico limitado e dispõe de uma fila em processo com três tarefas simultâneas e cinquenta pendentes por padrão. Adaptadores confiáveis podem fornecer pesquisa, voz, visão e serviço CODE.

A fila não é isolamento de processos. Cancelamento atual atende somente tarefas pendentes. Histórico de execução e permissões de tarefas ainda precisam de persistência completa.

Sem escopo e autorização, tarefas são bloqueadas; o GUARD padrão não concede execução de ações externas. Resultados só são concluídos pelo CORE quando o VERIFY fornece verificação positiva. A API HTTP autenticada fica em `../../src/server.js`.

Testes: `cd veris-cyber` e `npm test`.
