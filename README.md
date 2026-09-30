# VERIS-AI

**Versatile Executive Reasoning & Intelligence System** — plataforma independente de IA, com módulo especializado 4X4 para o aplicativo Trilha 4X4.

## Documentação principal

- [Plano mestre: histórico, arquitetura, etapas, aprendizado, sites, visão, voz e geração de vídeo](docs/PLANO-MESTRE.md)
- [API e instalação no PC](docs/api.md)
- [Notas da migração](docs/migracao.md)
- [Conhecimento do aplicativo Trilha 4X4](docs/CONHECIMENTO-TRILHA4X4.md)

**Identidade:** VERIS-AI é o produto; 4X4 é um módulo especializado. `IA-VERIS`, `VERIS_API_KEY` e `VERIS_URL` são nomes técnicos preservados para compatibilidade.

## Estado atual

- API inicial Node.js com `GET /health` e `POST /v1/chat`.
- Base 4X4: **49 registros para 50 perguntas** (a pergunta 8 foi incorporada à 2): **13 confirmados e 36 aguardando validação**.
- Apenas entradas confirmadas são recuperadas automaticamente.
- O backend do Trilha 4X4 já contém o adaptador para a API VERIS-AI; faltam os testes integrados reais no PC e no celular.
- A geração de vídeo é projeto futuro, inicialmente experimental apenas no PC e com meta de custo R$0.

**Prioridade:** estabilizar a VERIS-AI no aplicativo Trilha 4X4 antes de integrá-la a sites ou ativar novos módulos.
