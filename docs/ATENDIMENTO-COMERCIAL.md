# Etapa 5 — Piloto de atendimento comercial

O módulo comercial é independente da base de veículos 4X4. Nesta fase, a API está restrita ao proprietário e **não** há widget público, conexão com WhatsApp nem atendimento comercial em produção.

## Configuração privada

Copie `knowledge/businesses.example.json` para um arquivo JSON privado fora do repositório e defina `VERIS_BUSINESS_FILE` no `.env`. O exemplo da LF Moda Feminina está **desabilitado**, sem catálogo, preços ou políticas inventadas.

Para habilitar um piloto, altere `enabled` para `true` somente após cadastrar informações confirmadas pela loja. Cada FAQ deve ter `id`, `question`, `answer`, `approved:true` e, opcionalmente, `keywords`. FAQ sem aprovação não é utilizada. Perguntas sem resposta aprovada recebem mensagem de encaminhamento humano.

## Teste privado

`POST /v1/business/test` requer a chave administrativa `VERIS_OWNER_API_KEY` distinta da chave do Trilha 4X4. Exemplo de corpo JSON:

```json
{"business_id":"lf-moda-feminina","question":"Quais são os horários de atendimento?"}
```

Sem dados confirmados ou com a loja desabilitada, não há resposta comercial inventada. Não compartilhe a chave administrativa com navegador, widget, cliente ou WhatsApp.

## Próximas entregas

- Cadastrar catálogo, tamanhos, políticas, horário e canal de atendimento autorizados pela loja.
- Implementar autenticação por cliente, cotas, isolamento persistente e controle de origens antes de expor qualquer endpoint comercial.
- Criar widget instalável somente após estabilização do Trilha 4X4 e revisão de segurança.
- Integrar WhatsApp Business pelo canal oficial, com custos e autorização do cliente definidos.
- Implantar em hospedagem HTTPS com logs, monitoramento e limites de gastos.

Este piloto é baseado em FAQ determinística e não faz chamadas adicionais ao Groq.
