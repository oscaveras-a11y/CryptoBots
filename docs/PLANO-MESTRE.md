> Documento histórico da primeira fase. A direção atual é a central pessoal de afiliados descrita no README.md. Este conteúdo foi preservado como referência e não define os recursos ativos da versão 2.

# VERIS-AI — Plano mestre de produto e engenharia

**Versão:** 1.0 · **Data-base:** 29/09/2026 · **Estado:** documento vivo  
**Repositório:** `oscaveras-a11y/IA-VERIS`  
**Primeiro módulo:** 4X4, integrada ao aplicativo `oscaveras-a11y/Trilha-4X4`.

> **Princípio:** primeiro fazer a IA funcionar no Trilha 4X4; depois ampliar para sites e outras integrações. Separar rigorosamente o que foi implementado, o que foi apenas publicado em código, o que foi testado e o que é uma ideia futura. Não declarar um recurso pronto sem teste real.

## 1. Visão de longo prazo

VERIS-AI (Versatile Executive Reasoning & Intelligence System) é uma plataforma independente, modular e extensível de IA, com API própria e múltiplos clientes. O primeiro domínio é off-road; depois, poderão existir assistentes para lojas, oficinas, atendimento empresarial e outras aplicações, com bases e permissões isoladas. A ambição futura é oferecer conversação, pesquisa, memória, visão, voz e geração de mídia em uma experiência unificada. **Não há plano de treinar do zero, agora, um modelo da escala de Gemini/Grok**: começar orquestrando modelos existentes, base própria e infraestrutura viável, mantendo a opção de modelos abertos e ajustes especializados no futuro.

### Princípios fixos
- **Baixo custo inicial:** aproveitar PC próprio para desenvolvimento/testes; preferir ferramentas gratuitas e respeitar limites reais de uso. Não consumir conta paga do usuário automaticamente.
- **Arquitetura independente do fornecedor:** trocar modelo sem reescrever app, API, conhecimento ou autenticação.
- **Veículos modificados:** não presumir motor, câmbio, caixa de transferência, cardãs, eixos, freios ou eletrônica originais. Identificar a montagem real e sintomas antes de orientar. O manual de fábrica de um veículo de origem pode não descrever o conjunto preparado.
- **Segurança em campo:** em procedimentos de risco, priorizar estabilização, avaliação do terreno, pontos de recuperação dimensionados, exclusão de pessoas, prevenção de incêndio e assistência quando houver incerteza. Não inventar medidas, torques ou capacidades.
- **Aprendizado supervisionado:** novas perguntas e correções são candidatas a conhecimento; somente revisão e aprovação liberam uso coletivo. Memória pessoal ≠ conhecimento validado.
- **Privacidade:** consentimento, isolamento entre usuários/clientes, segredos apenas no backend, retenção limitada, proteção contra abuso e acesso administrativo auditável.
- **Evolução sem interrupção:** manter a IA atual do Trilha 4X4 enquanto a VERIS-AI não passar em testes de integração e campo.

## 2. Inventário: o que já existe e o que falta

| Área | Estado em 29/09/2026 | Próxima verificação |
|---|---|---|
| Repositório independente privado `IA-VERIS` | Criado; acesso de leitura/escrita verificado | Manter branch e revisão de mudanças |
| Base off-road | **49 registros para 50 perguntas**: pergunta 8 incorporada à 2; **13 CONFIRMADA** e **36 PENDENTE_VALIDACAO** | Entregar conjunto integral ao responsável para revisão, sem aprovar automaticamente |
| `knowledge/offroad.json` | Migrado do Trilha 4X4 | Conferir integridade e histórico de alterações |
| `lib/ai-knowledge.js` | Busca lexical, cache por mtime, top 4, somente `CONFIRMADA` | Avaliar sinônimos, testes de falsos positivos e busca semântica futura |
| `tests/ai-knowledge.js` | Migrado | Executar no PC e CI |
| `server.js` | API HTTP Node.js criada; `GET /health`, `POST /v1/chat` | Executar, testar falhas, revisar segurança e integrar ao app |
| Autenticação da API | Bearer key entre servidores, rate limit por IP e corpo limitado | Testar sob túnel/proxy; futuramente credenciais por cliente, rotação e limites separados |
| Modelo externo | Adaptador inicial compatível com API OpenAI, opcional; sem chave usa base validada | Validar com provedor gratuito disponível e limites vigentes |
| `.env.example`, documentação e workflow de testes | Publicados | Confirmar resultados do CI e testes locais |
| Pesquisa externa | Existe experiência anterior no Trilha 4X4 com Tavily; **não migrada para VERIS** | Adaptador opcional com fontes e política de custo |
| Memória por usuário | Experiência anterior no app (armazenamento local limitado); **não migrada como memória central VERIS** | Desenhar consentimento e retenção |
| Integração Trilha 4X4 → VERIS-AI | Adaptador implementado no backend; testes reais pendentes | Validar conexão local, Groq e celular sem expor a chave |
| Hospedagem em PC | Planejada, ainda não instalada/testada neste repositório | Instalar e testar em localhost; depois túnel HTTPS |
| Site e outros clientes | Planejados | Somente depois de estabilizar o aplicativo |
| Geração de vídeo | Projeto futuro **pausado** | Protótipo isolado no PC, sem integrar ao app antes de funcionar |

## 3. Mapa de arquitetura

```text
                          CLIENTES (fases progressivas)
          ┌────────────────────┬───────────────────┬───────────────────┐
          │ Trilha 4X4         │ Chat em sites     │ Outros sistemas   │
          │ primeiro cliente   │ etapa posterior   │ etapa futura      │
          └──────────┬─────────┴─────────┬─────────┴─────────┬─────────┘
                     └───────────────────┼───────────────────┘
                                         │ HTTPS
                                ┌────────▼────────┐
                                │ API GATEWAY     │
                                │ Auth / limites  │
                                │ versão / logs   │
                                └────────┬────────┘
                         ┌───────────────┼──────────────────┐
                  ┌──────▼──────┐ ┌──────▼──────┐ ┌─────────▼─────────┐
                  │ Módulo 4X4 │ │ Módulo Sites│ │ Módulos futuros   │
                  │ RAG / KB   │ │ KB isolada  │ │ voz / visão/vídeo │
                  └──────┬──────┘ └──────┬──────┘ └─────────┬─────────┘
                         └───────────────┼──────────────────┘
                               ┌─────────▼─────────┐
                               │ ORQUESTRADOR      │
                               │ modelo/fallback   │
                               │ ferramentas       │
                               │ políticas         │
                               └─────┬───────┬─────┘
                        ┌────────────▼┐ ┌────▼────────────────┐
                        │ Memória com │ │ Modelos locais ou  │
                        │ consentimento│ │ provedores externos│
                        └─────────────┘ └─────────────────────┘
```

**Observação:** o diagrama é a arquitetura-alvo, não uma declaração de que todos os blocos já existem. Na versão inicial, a API implementa o primeiro módulo 4X4 com chave única entre servidores.

### Contrato atual da API
- `GET /health` → status do serviço.
- `POST /v1/chat` → `{ "question": "...", "context": { ... } }` com `Authorization: Bearer ...`.
- Resposta → `answer`, `mode`, `module`, `knowledge` e `needs_review`.
- Futuro: `/v1/modules`, `/v1/feedback`, `/v1/knowledge/review`, `/v1/memory`, `/v1/vision`, `/v1/audio`, `/v1/video/jobs`; **nomes reservados para planejamento, não endpoints implementados**.
- A autenticação de usuários finais pertence inicialmente ao backend do Trilha 4X4; **nunca** embutir a chave de servidor em PWA, app móvel ou JavaScript público.

## 4. Histórico consolidado de decisões e avanços

### Origem: assistente do Trilha 4X4
- Projeto mobile-first PWA com Node.js/Express e SQLite, GPS/trilhas, grupos, passeios, navegação, segurança/SOS e chat; intenção de anúncios como monetização inicial.
- Primeiras experiências com provedor OpenAI e problemas de faturamento; exploração de alternativas mais econômicas, Groq e Tavily opcional. 9Router foi experimentado, mas não é dependência obrigatória da VERIS; eventual fallback externo só após falha do motor principal, com a mesma política de segurança.
- Chat do app passou a receber contexto do veículo/trilha e controles de login, rate limit e respostas de fallback. Histórico local limitado e testes adversariais ainda precisam de validação em campo.

### Especialização 4X4
- Construção colaborativa de 50 perguntas de mecânica, técnicas de condução, recuperação, equipamentos, navegação e emergência.
- Pergunta 8 consolidada na 2: 49 registros únicos.
- Primeiro lote com 13 registros confirmados; 36 posteriores preservados como pendentes, **não habilitados na recuperação automática**.
- Ênfase em veículos preparados: conjuntos de diferentes marcas e origens, sem confiar em especificação de veículo original. Antes de sugerir remover cardã/semieixo, conduzir com falha de transmissão, usar guincho ou definir pressão de pneu, pedir a configuração real e reconhecer limites de segurança.
- Motor de conhecimento migrado para repositório separado com testes iniciais.

### Independência da VERIS-AI
- Repositório privado `IA-VERIS` criado em 29/09/2026, nome escolhido para permitir outras especializações.
- API inicial, documentação, variáveis de ambiente e workflow de testes adicionados.
- Decisão: **rodar primeiro no PC do usuário**, conectar ao Trilha 4X4 por API HTTPS e migrar para hospedagem 24h somente quando uso real justificar.

## 5. Roadmap executivo por fases

### Fase 0 — Fundação e verificações [EM ANDAMENTO]
**Objetivo:** código reproduzível e API inicial confiável.
- [x] Criar repositório privado independente.
- [x] Migrar 49 registros e motor de recuperação.
- [x] Criar `/health`, `/v1/chat`, Bearer key, limites básicos e `.env.example`.
- [x] Criar testes de base e API e workflow CI.
- [ ] Confirmar execução do CI; corrigir eventuais falhas.
- [ ] Rodar `npm.cmd run check` no PC Windows.
- [ ] Revisar erro de rede, timeouts, concorrência, validação de entrada, logs sem segredos e comportamento sob proxy.
- [ ] Documentar versionamento da API, esquema de erros e limites.

**Critério de saída:** testes passando, `/health` e `/v1/chat` respondendo localmente com e sem modelo externo, sem exposição de chave.

### Fase 1 — VERIS-AI com módulo 4X4 no PC e no aplicativo [PRIORIDADE MÁXIMA]
- [ ] Clonar `IA-VERIS` no PC e configurar chave local.
- [ ] Testar consulta offline à base confirmada (servidor local, sem provedor externo).
- [ ] Testar modelo online opcional e fallback seguro se houver indisponibilidade, custo ou limite.
- [ ] Publicar via Cloudflare Tunnel HTTPS para testes controlados; URL fixa/domínio apenas quando configurado.
- [x] Implementar adaptador no **backend** do Trilha 4X4 para `/v1/chat` da VERIS-AI, preservando login e interface atual; validação integrada pendente.
- [x] Implementar fallback para o chat anterior quando a VERIS-AI falhar; ainda testar no PC e celular que, com a VERIS-AI fora do ar, o app informe indisponibilidade ou use fallback existente de forma explícita; não mascarar erro com resposta inventada.
- [ ] Testar em PC e iPhone/Android: autenticação, perguntas difíceis, tempo de resposta, internet instável, falhas do túnel, vazamento de chave e comportamento do SOS (sem depender da IA).
- [ ] Só desativar lógica duplicada da IA antiga depois da aprovação dos testes.

**Critério de saída:** trilheiro conversa com VERIS pelo aplicativo, recebe respostas rastreáveis, não vê chave de API e não perde recursos essenciais se o serviço cair.

### Fase 2 — Revisão da base e qualidade [APÓS A FASE 1 OU EM PARALELO SEM BLOQUEAR]
- [ ] Gerar **caderno completo das 50 perguntas e respostas**, indicando a pergunta 8 incorporada à 2.
- [ ] Revisão humana pelo responsável: aprovar, editar, rejeitar ou solicitar pesquisa para cada item.
- [ ] Validar procedimentos de risco com documentação do componente realmente instalado e boas práticas de recuperação; registrar fonte, versão, revisor e data.
- [ ] Publicar apenas entradas aprovadas; manter histórico das correções e possibilidade de reversão.
- [ ] Testar busca com sinônimos brasileiros (atolou/encalhou, cardã/eixo, reduzida/4L) e questões ambíguas.
- [ ] Criar avaliação fixa com casos normais, falta de contexto, tentativas de instruções maliciosas e cenários perigosos.

**Critério de saída:** 49 registros revisados individualmente, com rastreabilidade e cobertura de testes.

### Fase 3 — Memória e aprendizado supervisionado
- [ ] Perfil opcional do veículo real: motor, câmbio, transferência, eixos, pneus, pressão de uso, bloqueios, guincho e modificações.
- [ ] Memória individual **opt-in**, editável, exportável e apagável; retenção definida e criptografia adequada.
- [ ] Capturar com consentimento dúvidas não respondidas e feedback de qualidade; remover dados pessoais antes de reutilizar.
- [ ] Painel administrativo: pergunta nova → proposta de resposta → evidências → revisão → publicação → monitoramento → reversão.
- [ ] Identificar perguntas recorrentes e lacunas da base; não converter automaticamente respostas do modelo ou opiniões de usuários em verdade técnica.
- [ ] Futuro: busca híbrida lexical + embeddings e recuperação contextual, com medição de precisão.

**Critério de saída:** melhoria mensurável da qualidade sem contaminação do conhecimento coletivo nem mistura de memórias pessoais.

### Fase 4 — Pesquisa externa e múltiplos modelos
- [ ] Pesquisar somente quando houver necessidade: atualidades, preço, legislação, disponibilidade, especificação exata ou lacuna da base.
- [ ] Citar fontes, distinguir documentação técnica de relatos de fórum, preservar data e registrar incerteza.
- [ ] Adaptadores substituíveis para modelos online e abertos locais, com roteamento por custo, latência e capacidade.
- [ ] Fallback opcional (inclusive alternativas como 9Router, **somente se testadas e autorizadas**) após falha do motor principal; aplicar as mesmas regras de segurança.
- [ ] Medir tokens, cotas, custo real, tempo de resposta e disponibilidade; desabilitar chamadas pagas não autorizadas.
- [ ] Sem execução autônoma de ações externas ou navegação privilegiada sem escopo e autorização explícitos.

### Fase 5 — VERIS-AI para sites e integrações
- [ ] Criar widget de chat instalável em site **somente após estabilizar no Trilha 4X4**.
- [ ] Primeiro piloto possível: LF Moda Feminina, com catálogo, tamanhos, políticas e atendimento fornecidos pela loja; **base separada do módulo 4X4**.
- [ ] API multi-tenant: credenciais por cliente, limites de uso, origem permitida, isolamento de dados, logs e métricas.
- [ ] Futuro: integração WhatsApp Business por canal oficial, respeitando preços e regras do provedor; chatbot simples sem IA como opção para clientes.
- [ ] Painel de conhecimento por negócio, transferência para atendente humano e configuração de horários/escopo.
- [ ] Hospedagem dedicada quando a demanda comercial exigir disponibilidade 24h; PC doméstico continua adequado apenas para desenvolvimento/testes iniciais.
- [ ] Monetização futura: implantação, hospedagem, manutenção, planos de atendimento e recursos premium; custos de IA/WhatsApp transparentes para cada cliente.

### Fase 6 — Visão, voz e multimodalidade [FUTURO]
- [ ] Receber fotos de componentes, pneus, vazamentos, trilhas e danos; analisar com incerteza explícita, sem prometer diagnóstico definitivo.
- [ ] Áudio: transcrição de perguntas e respostas por voz para mãos livres **sem incentivar interação ao dirigir em trecho de risco**.
- [ ] Vídeo de inspeção enviado pelo usuário: resumir observações, identificar possíveis problemas e recomendar verificação humana.
- [ ] Consentimento e limites para imagens de pessoas, placas, localização, áudio e dados sensíveis.
- [ ] Testar desempenho, cotas e custo por modalidade antes de habilitar para todos.

### Fase 7 — Motor de geração de vídeo VERIS-AI [FUTURO, PROJETO PAUSADO]
**Escopo acordado:** desenvolvimento e testes **somente no PC**; não integrar ao Trilha 4X4 até gerar vídeos de qualidade aceitável. **Meta inicial R$0**, sem assinatura ou consumo automático de créditos pagos.

**Capacidades desejadas em ordem:**
1. Texto → vídeo curto, com roteiro, storyboard e instruções de câmera/movimento.
2. Imagem → vídeo, preservando identidade visual e movimento coerente; evitar sequências de fotos estáticas.
3. Vídeo → vídeo: aprimorar material existente, legendas, cortes, música/narração e exportação em formatos vertical/horizontal.
4. Fluxo com cenas múltiplas, consistência entre quadros, revisão e exportação; integração com VERIS somente após protótipo comprovado.
5. Aplicações futuras: demonstrações off-road, apresentação do Trilha 4X4, publicidade de produtos, conteúdo para sites e canais sociais.

**Restrições técnicas registradas:** PC de testes anterior com Pentium Gold G5400, aproximadamente 4 GB RAM e sem GPU NVIDIA dedicada; **não é adequado para modelos modernos de vídeo locais**. Pode hospedar API, orquestração, fila e montagem leve, mas geração pesada exige GPU externa, execução gratuita disponível com cotas reais ou atualização de hardware.

**Alternativas a investigar, sem assumir acesso gratuito permanente:** espaços públicos de demonstração (ex.: Hugging Face ZeroGPU, sujeitos a limites e sem API garantida), notebooks gratuitos quando disponíveis e modelos abertos como famílias Wan, LTX-Video e CogVideoX em hardware compatível. Não integrar serviço cuja licença, quota, qualidade ou uso automatizado não tenha sido verificado.

**Hardware futuro estudado, não comprado:** opção de workstation com RTX 3090 24 GB, 64 GB RAM, NVMe 2 TB e Ryzen 7; reavaliar preço e compatibilidade antes de qualquer compra. Duas GPUs de 16 GB não equivalem automaticamente a uma GPU de 32 GB de VRAM.

**Critérios de aceitação:** movimento real (não slideshow), coerência temporal, resolução/duração adequadas, custo por vídeo conhecido, uso legal de imagens/áudio e execução reproduzível antes de conectar a API.

### Fase 8 — Plataforma de IA mais ampla [VISÃO DE LONGO PRAZO]
- [ ] API pública/privada com documentação, SDKs, faturamento por cliente, quotas e observabilidade.
- [ ] Catálogo de módulos especializados, permissões e memória separadas.
- [ ] Ferramentas controladas para análise de documentos, imagens, pesquisa e automação autorizada.
- [ ] Considerar ajuste fino de modelos abertos **apenas** com dados suficientes, licenciados e validados; comparar resultados com RAG antes de investir.
- [ ] Escalabilidade, redundância, backup, gestão de incidentes e auditoria.
- [ ] Não equiparar um assistente com várias funções a um modelo fundamental de fronteira; estabelecer metas técnicas e comerciais mensuráveis.

## 6. Segurança, governança e qualidade

**Ameaças a cobrir:** injeção de prompt por usuário/web/arquivo, extração de segredos, abuso de API, alucinação técnica, respostas perigosas de recuperação, vazamento entre clientes, armazenamento indevido de localização e custo inesperado.

**Medidas mínimas:** autenticação no backend, chaves rotacionáveis, HTTPS, rate limit por cliente e usuário, entrada/saída limitadas, logs sem mensagens sensíveis por padrão, retenção curta, consentimento para aprendizado, segregação de dados, revisão humana de procedimentos perigosos, testes de regressão e fallback seguro.

**Métricas:** taxa de respostas úteis e corretas em conjunto revisado; citações de KB; recusas corretas por falta de contexto; incidentes de segurança; latência p50/p95; uptime; custo por 1000 perguntas; qualidade do vídeo (quando houver); percentual de itens pendentes.

## 7. Dependências e ordem de execução

```text
CI e testes da API
       ↓
Servidor VERIS no PC → modelo opcional/fallback
       ↓
Backend Trilha 4X4 → VERIS por HTTPS → testes reais no celular
       ↓
Validação integral das 49 entradas + painel de revisão
       ↓
Memória consentida + pesquisa externa + roteamento de modelos
       ↓
Widget para sites e atendimento empresarial
       ↓
Visão/voz e outras integrações
       ↓
Geração de vídeo (protótipo PC independente; integração só após aprovação)
       ↓
Plataforma multiuso e possíveis modelos especializados
```

A validação das 36 entradas pendentes pode ocorrer em paralelo aos testes da API; **não liberar as entradas antes da revisão**. Pesquisa externa, modelos alternativos e vídeo são módulos opcionais, nunca requisitos para o SOS do aplicativo.

## 8. Próxima sessão de trabalho — checklist objetivo

1. Abrir [Actions](https://github.com/oscaveras-a11y/IA-VERIS/actions) e conferir testes da branch principal.
2. No PC: clonar repositório, copiar `.env.example` para `.env`, gerar chave forte, executar `npm.cmd run check` e `npm.cmd start`.
3. Confirmar `/health`, uma pergunta coberta pela KB e uma pergunta não validada; verificar que a pendente não foi tratada como confirmada.
4. Testar o adaptador do modelo externo somente se houver acesso gratuito disponível e autorizado.
5. Preparar alteração **no backend** do Trilha 4X4 para encaminhar chamadas à VERIS; nunca expor `VERIS_API_KEY` no frontend.
6. Validar no celular e registrar resultados antes de alterar produção.
7. Preparar o caderno de revisão das 50 perguntas, com 49 respostas únicas e marcação de cada item.

## 9. Registro de decisões futuras

Registrar toda decisão relevante com data, responsável, alternativa considerada, custo, risco e resultado de teste. Este plano deve ser atualizado conforme o código e os testes reais evoluírem, sem transformar propostas em entregas concluídas.


## Atualização de execução — 30/09/2026

- Nome público padronizado para **VERIS-AI** na interface e no servidor; módulo especializado identificado como **Módulo 4X4**.
- Backend do Trilha 4X4 já chama `/v1/chat` da VERIS-AI quando `VERIS_URL` e `VERIS_API_KEY` estão configurados, com fallback para o chat anterior se a VERIS-AI falhar.
- Tempo limite do adaptador do Trilha ampliado para 20 segundos para acomodar chamadas ao Groq.
- O `.env.example` do Trilha foi limpo de um valor de chave; a chave anteriormente exposta deve ser substituída nos ambientes reais.
- **Pendente para encerrar a Fase 1:** executar ambos os servidores no PC, confirmar respostas gerais e técnicas pela interface e pelo Trilha, testar Groq real, falhas de conexão e validação no celular. Os testes de CI não substituem essa validação.
- **Fase 2 (documentação/identidade):** README e plano mestre atualizados com a nova marca; preservar identificadores internos de API e variáveis existentes para compatibilidade.


## Etapa de identidade e documentação — atualização

- Identidade pública: **VERIS-AI**. **Módulo 4X4** identifica apenas a especialização off-road; **Trilha 4X4** é o aplicativo cliente.
- Interface, identificação de serviço, README, documentação de API, notas de migração e documentação do conhecimento do aplicativo padronizados.
- Nome do repositório `IA-VERIS`, variáveis `VERIS_API_KEY` e `VERIS_URL` e caminhos de API mantidos para não quebrar configurações existentes.
- Documentado o procedimento local de conexão com o Trilha 4X4, os erros básicos e o estado real da integração. Testes de execução conjunta no computador, Groq real e celular continuam pendentes.


## Avanço da qualidade — 30/09/2026

- Implementada normalização de sinônimos regionais em `lib/ai-knowledge.js`, com regressões para atolamento, pneus e exclusão de conteúdo pendente.
- Criado `docs/CADERNO-REVISAO-4X4.md`: inventário individual dos 49 registros originais (13 confirmados, 36 pendentes) mais uma orientação geral adicional. Nenhuma entrada pendente foi aprovada automaticamente.
- Implementada API `POST /v1/feedback` com consentimento explícito e motivos enumerados, sem armazenamento de perguntas em texto livre. `GET /v1/feedback` é exclusivo da chave administrativa; não há publicação automática.
- Pendências da etapa de qualidade: revisão técnica humana dos 36 registros, fontes e versões específicas por entrada, interface de feedback, política de retenção e avaliação em uso real.

