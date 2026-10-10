# Motor dos 12 agentes

O CORE registra SENSE, MIND, MEMORY, PLANNER, RESEARCH, CODE, CYBER, ACTION, GUARD, VERIFY, VISION e VOICE. São módulos especializados de um mesmo sistema; não são 12 modelos neurais treinados.

GET /api/core/capabilities (credencial local) distingue registered, ready e, para MIND, modelReady. VOICE distingue transcriptionReady e speechReady. O painel consulta essas capacidades. Disponibilidade de RESEARCH indica adaptador instalado, não conexão Tor comprovada.

POST /api/core/agents/AGENTE/tasks recebe o objeto de entrada do agente e retorna ID da fila; GET /api/core/tasks/ID acompanha. POST /api/core/tasks/ID/cancel cancela apenas pendentes. Erros e timeouts ficam no resultado; nunca são declarados sucesso. A fila é limitada e mantém histórico limitado. Os 12 handlers foram exercitados em testes; adaptadores de modelo, visão, áudio e ferramentas são injetados pelo host, nunca pelo corpo HTTP.

CODE/CYBER exigem projeto e ID de permissão do proprietário. ACTION exige autorizador e executor de ferramentas do host e revalida antes de executar. Não há shell arbitrário. MIND continua com planejamento nativo; texto neural depende do modelo local ainda não instalado. VISION e VOICE não interpretam mídia sem adaptador. ACTION não automatiza Windows sem ferramentas cadastradas.

## CYBER local

POST /api/cyber recebe {operation,project,permissionId,jobId,baselineId}. Operações: start, get, cancel, report. Permissão local security-audit emitida por npm run code-access -- grant arquivo.json. Projetos registrados em config/projects.json. Permissões têm allowPaths, denyPaths e expiresAt; nunca recebem raiz pela API.

Varredura somente de arquivos permitidos; exclui .git, dependências instaladas, arquivos de segredo e links simbólicos. Limites: 200 arquivos, 300000 bytes totais. Findings são heurísticos e não incluem trechos de segredo. Inventário npm diferencia declaração e lockfile v2/v3; versões de fontes externas são omitidas para proteger credenciais/paths. Outros ecossistemas não são auditados. Vulnerabilidades de dependências não foram consultadas: not_checked.

Relatórios JSON/Markdown retornam no endpoint, sem escrita automática no projeto. Até 20 jobs em memória, perdidos no reinício. Comparação exige baseline concluída do mesmo projeto e permissão vigente para todos os caminhos presentes ou históricos. noLongerDetected significa ausência na nova leitura, sem comprovar remediação. Cancelamento cooperativo interrompe a leitura, sem alterações nos arquivos.

O laboratório usa diretório temporário com achados conhecidos; nenhum alvo externo é contatado. Não há exploração de vulnerabilidades ou pentest ativo.

## Instalação pendente

Modelo local MIND, mecanismos de visão/áudio e ferramentas ACTION ainda precisam ser configurados e testados em hardware real. Este commit entrega o motor de coordenação e auditoria local; não declara todos esses mecanismos prontos.
