# IA-VERIS

**Versatile Executive Reasoning & Intelligence System** — plataforma independente de IA, começando pelo módulo VERIS 4X4 para o aplicativo Trilha 4X4.

## Documentação principal

- [Plano mestre: histórico, arquitetura, etapas, aprendizado, sites, visão, voz e geração de vídeo](docs/PLANO-MESTRE.md)
- [API e instalação no PC](docs/api.md)
- [Notas da migração](docs/migracao.md)

## Estado atual

- API inicial Node.js com `GET /health` e `POST /v1/chat`.
- Base 4X4: **49 registros para 50 perguntas** (a pergunta 8 foi incorporada à 2): **13 confirmados e 36 aguardando validação**.
- Apenas entradas confirmadas são recuperadas automaticamente.
- A integração com o aplicativo Trilha 4X4 e a instalação no PC ainda precisam ser testadas.
- A geração de vídeo é projeto futuro, inicialmente experimental apenas no PC e com meta de custo R$0.

**Prioridade:** estabilizar a VERIS no aplicativo Trilha 4X4 antes de integrá-la a sites ou ativar novos módulos.
