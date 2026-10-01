# API VERIS central pessoal (v2)

Endpoints privados requerem sessão de proprietário ou `Authorization: Bearer <VERIS_OWNER_API_KEY>`. A chave de API antiga padrão não concede acesso. Nunca exponha a chave no frontend.

No navegador, `POST /api/login` recebe `{password}` e exige `Origin` igual ao host. O retorno fornece `csrf`; as alterações subsequentes usam `X-CSRF-Token`, Origin e cookie HttpOnly. `POST /api/logout` encerra a sessão. `/health` e arquivos estáticos públicos não contêm dados pessoais.

| Método | Endpoint | Operação |
|---|---|---|
| GET | /api/session | Sessão e CSRF |
| GET | /api/state | Painel completo e estados reais dos provedores |
| GET | /api/export | Backup JSON privado |
| POST | /api/products | Cadastro de produto |
| PATCH / DELETE | /api/products/:id | Editar / excluir sem campanhas vinculadas |
| POST | /api/import | `{products:[...]}` ou `{csv:"..."}`, até 100 |
| POST | /api/chat (ou /v1/chat) | `{question,provider?,session_id?,reset_session?}` |
| POST | /api/campaigns | `{product_id,channel,mode:"template" ou "ai",provider?}` |
| PATCH | /api/campaigns/:id | Alterar campos do conteúdo e retirar aprovação |
| POST | /api/campaigns/:id/approve | `{confirmed:true}`, exige link e identificação comercial |
| GET | /api/campaigns/:id/export | Texto completo da campanha |
| POST | /api/campaigns/:id/published | `{confirmed:true,publication_url}`, registro manual |
| POST | /api/contacts | Nome, canal, identificação e consentimento documentado |
| POST | /api/ledger | Tipo, situação, valor, descrição, data, canal e campanha opcional |
| PATCH | /api/ledger/:id | Alterar situação financeira |
| POST | /api/memory | `{text}` |
| POST | /api/reports | Relatório de dados cadastrados |
| POST | /api/workflows | Até três campanhas e relatório; `mode` e `provider` opcionais |
| POST | /api/tasks | Nome, tipo report/campaign_drafts, intervalo 1–720h |
| PATCH | /api/tasks/:id | `{enabled:boolean}` |
| POST | /api/tasks/:id/run | Executar agora |
| DELETE | /api/{contacts,memory,campaigns,tasks,conversations}/:id | Excluir registro |

Dados monetários são informados em reais no cadastro e salvos em centavos. Produtos armazenam percentuais e preço opcionais. Campos: title, platform, price, commission_percent, affiliate_url, product_url, source_url, observed_at, demand, competition, notes, image_url. `demand` e `competition` são avaliações manuais de 0 a 5. Fontes cadastradas são declaradas pelo proprietário; não são automaticamente verificadas.

Provedores aceitos: auto, groq, gemini, local. Outros são rejeitados. O modelo Gemini não tem padrão embutido: escolha um modelo elegível no console. Sem chave/cota confirmada, o chat retorna 503; limite local ou cota esgotada retorna 429. Não retorna uma resposta fictícia da IA.

Nenhum endpoint envia WhatsApp, publica TikTok, realiza pagamento ou habilita API paga. A referência da primeira versão está em `api-legada.md`; os endpoints legados não estão expostos pelo servidor novo.
