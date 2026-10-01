# VERIS-AI — Central pessoal de negócios

Versão 2: ferramenta pessoal para organizar afiliados, preparar campanhas e acompanhar resultados. Independente do Trilha 4X4. O código e a base da versão 4X4 foram preservados em `legacy-server.js`, `public/legacy.html` e `knowledge/`; não são iniciados pelo aplicativo novo.

## Começar no computador

Requer Node.js 22 ou superior. Não há dependências externas de execução.

```powershell
 git pull
 npm run setup
 npm run check
 npm start
```

Abra http://127.0.0.1:3100 e entre com a senha criada no setup. O setup cria/atualiza `.env` sem mostrar credenciais e preserva as configurações existentes. Nunca envie `.env`, `data/` ou backups ao GitHub. A versão antiga não tinha senha de usuário: ela não é reutilizada.

## O que funciona

- Login privado com senha derivada por scrypt, sessão HttpOnly e proteção CSRF.
- Painel adaptável ao celular; oportunidades, estúdio, contatos, financeiro, rotinas e conexões.
- Produtos e links de Mercado Livre, Shopee, TikTok, WhatsApp e outros canais, com importação JSON/CSV.
- Comparação transparente dos dados informados; avisos de dados ausentes e fontes desatualizadas.
- Groq, Gemini e Ollama local: chamadas reais implementadas, seleção por tarefa, fallback entre provedores habilitados e limites locais de tentativas.
- Conversas persistentes e memórias editáveis. Os dados contextuais podem ser enviados ao provedor escolhido; não registre segredos nesses campos.
- Campanhas com legenda, roteiro de 15 segundos, mensagem e prompts de mídia. Modelos de texto funcionam sem IA; criação por IA depende das credenciais.
- Estúdio local: card PNG 1080×1920, vídeo de 15 segundos com movimento (WebM/MP4 conforme navegador), imagem e áudio fornecidos pelo usuário, prévia de voz do navegador. Não é geração de mídia por IA; prévia de voz não é incluída no vídeo. Mídia é exportada localmente e não enviada ao servidor.
- Revisão, aprovação e exportação de campanhas. Alterar o produto ou o texto invalida a aprovação.
- Registro manual da publicação realizada por você, com URL de comprovação.
- Cadastro de contatos e autorização comercial; nenhum envio automático.
- Comissões pendentes/recebidas, despesas pagas, lucro registrado e relatórios.
- Rotinas persistentes para preparar rascunhos/relatórios; executam a cada 30 segundos enquanto o servidor está ligado. Não usam APIs de IA nem publicam conteúdo.
- Exportação completa dos dados em JSON. A importação atual é de produtos; o backup integral é recuperado pelo arquivo de dados com o servidor parado.

## Ativar IA sem APIs pagas

No `.env`, configure apenas chaves de contas/projetos sem faturamento habilitado:

- Groq: `GROQ_API_KEY`, `GROQ_MODEL` e `GROQ_FREE_TIER_CONFIRMED=true`.
- Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL` com cota gratuita vigente e `GEMINI_FREE_TIER_CONFIRMED=true`.
- Modelo local: instale Ollama, baixe um modelo adequado ao computador e configure `LOCAL_ENABLED=true`, `LOCAL_MODEL` e endereço de loopback.

`VERIS_DAILY_AI_REQUESTS=30` limita o total de tentativas por dia UTC, incluindo erros e fallbacks. O servidor contabiliza reservas antes de enviar a chamada, inclusive após reiniciar. Tokens vêm do retorno dos provedores quando disponíveis.

**O aplicativo não consegue verificar o faturamento da sua conta.** A opção de confirmação é uma declaração do proprietário. Confira o console do provedor e não use uma chave ligada a projeto pago. As cotas gratuitas e os modelos disponíveis podem mudar. Ao esgotar cota, a aplicação informa o problema ou tenta outro provedor gratuito habilitado; não ativa serviços pagos.

OpenAI, Grok, Claude e Codex dentro da API estão desativados. ChatGPT e Codex são usados externamente no desenvolvimento; sua assinatura não é uma chave de API da VERIS.

## O que ainda depende de conexão externa

A central **não faz pesquisa ao vivo** de catálogo, preços, tendências ou comissões. Esses dados vêm de cadastro/importação e não são considerados verificados automaticamente. Também não gera links de afiliado, não associa sacolas do TikTok e não consulta vendas diretamente.

OAuth e permissões oficiais de Mercado Livre, Shopee, TikTok e WhatsApp Business precisam ser configurados e validados antes de desenvolver a operação automática de cada conta. O aplicativo WhatsApp Business gratuito e a plataforma/API de mensagens são produtos diferentes; nenhuma API de envio foi ativada nesta fase de orçamento zero.

Geração de mídia por IA, vídeo por IA e narração exportável por IA exigem uma ferramenta com acesso gratuito confirmado. Os prompts ficam preparados na campanha.

## Operação e recuperação

O banco JSON é escrito em arquivo temporário e substituído após fsync. Um arquivo `.lock` evita dois processos usando o mesmo banco. Para recuperar após desligamento inesperado: confirme que nenhuma VERIS está rodando, preserve um backup de `data/business.json` e só então remova `data/business.json.lock`. Não execute múltiplas instâncias apontando para o mesmo arquivo.

Para acesso remoto, use HTTPS e `NODE_ENV=production` (cookies Secure). A porta deve ficar privada; não publique a interface antiga. As sessões expiram em oito horas e são encerradas ao reiniciar. O banco não é criptografado em disco: mantenha a máquina e os backups privados.

## Validação

`npm run check` verifica o código, as bases legadas e os testes da nova central: acesso privado, CSRF, cálculos financeiros, persistência, campanhas, rotinas, importação, bloqueio de APIs pagas, falhas de provedor e cotas. A interface foi testada em navegador com larguras de computador e celular, incluindo cadastro, revisão, aprovação e exportação de PNG e vídeo WebM 1080×1920. A exportação com áudio e o codec MP4 ainda precisam ser validados no dispositivo de uso. Os testes de provedores usam respostas controladas, sem cobrança. **Uma conversa real ainda precisa ser testada após configurar suas credenciais.**

Documentação de referência: [Groq](https://console.groq.com/docs/api-reference), [limites Groq](https://console.groq.com/docs/rate-limits), [Gemini generateContent](https://ai.google.dev/api/generate-content), [cotas/preços Gemini](https://ai.google.dev/gemini-api/docs/pricing), [TikTok Content Posting](https://developers.tiktok.com/docs/en/content-posting-api-get-started), [WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
