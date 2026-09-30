# VERIS-AI — operação e publicação segura

## Situação

Este documento prepara o serviço para hospedagem, mas **não constitui implantação pública**. A integração real com Trilha 4X4, o domínio HTTPS, o proxy reverso e o monitoramento externo ainda exigem testes no ambiente de destino.

## Ambiente de produção

1. Use Node.js 22 em servidor com acesso restrito. Clone o repositório e crie o `.env` privado a partir de `.env.example`; nunca versione chaves.
2. Gere uma **nova** `VERIS_API_KEY` aleatória de 32 bytes ou mais. Configure a mesma chave no backend Trilha 4X4; rotacione qualquer chave anteriormente exposta no histórico do Git.
3. Configure `NODE_ENV=production`, `VERIS_ENABLE_TEST_KNOWLEDGE=false`, `HOST=127.0.0.1` e `PORT=3100`. Produção desabilita a interface web de testes e rejeita a base experimental.
4. Se utilizar Groq, configure `MODEL_API_KEY` somente no servidor, defina cotas/limites no provedor e acompanhe custos. Sem a chave, o fallback local permanece disponível para entradas confirmadas.
5. Publique externamente apenas por proxy reverso com TLS/HTTPS, autenticação e restrições de acesso apropriadas. Não exponha diretamente a porta 3100 nem a interface de testes.
6. Execute `npm run check` antes de publicar. Inicie com `npm start` usando gerenciador de serviços com reinício automático. Confirme `GET /health` localmente e teste `POST /v1/chat` com uma pergunta geral e uma 4X4.
7. No Trilha, configure `VERIS_URL` com a URL HTTPS interna/segura e `VERIS_API_KEY` correspondente. Verifique que o chat retorna `source: veris`, inclusive após reinício. Teste timeout e fallback.

## Proteção de dados e disponibilidade

- A API tem autenticação por bearer token, limite de requisições e CORS configurável. CORS não substitui autenticação.
- A interface web sem login é **somente para testes privados** e é desativada em produção.
- A base experimental das 36 respostas só deve ser usada em desenvolvimento, nunca em ambiente público.
- Armazene `data/` e `VERIS_FEEDBACK_FILE` em volume privado com backup e retenção definida. Não registre perguntas, tokens ou chaves em logs.
- Faça backup criptografado dos dados persistentes e teste a restauração antes da implantação pública.
- Registre disponibilidade, latência e contagem de erros sem coletar conteúdo sensível; configure alertas de indisponibilidade e limite de gastos no provedor.
- Defina procedimento de rotação de chaves e de reversão para o commit anterior em caso de falha.

## Ainda pendente para declarar produção

Hospedagem e domínio escolhidos, certificado HTTPS, supervisão de processo, logs e métricas persistentes, alertas, política de backup/retenção, teste real com Groq e teste ponta a ponta com Trilha 4X4.
