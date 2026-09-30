# API VERIS-AI

API independente com o módulo especializado **4X4**. As 49 entradas foram migradas do Trilha 4X4: 13 confirmadas e 36 aguardando revisão. O mecanismo usa somente as confirmadas.

## Iniciar no Windows (PowerShell)

Requisitos: Git e Node.js 22 ou superior.

```powershell
git clone https://github.com/oscaveras-a11y/IA-VERIS.git
cd IA-VERIS
Copy-Item .env.example .env
```

Edite o arquivo `.env` e substitua `VERIS_API_KEY` por uma chave aleatória de pelo menos 32 caracteres. Você pode gerar uma com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não publique nem compartilhe essa chave. Depois:

```powershell
npm.cmd run check
npm.cmd start
```

O serviço responde em `http://127.0.0.1:3100/health`.

## Contrato da API

`POST /v1/chat` com cabeçalho `Authorization: Bearer SUA_CHAVE` e JSON:

```json
{
  "question": "Meu jipe está atolado na lama, o que faço?",
  "context": {
    "vehicle": "Jipe preparado",
    "engine": "não informado",
    "transmission": "não informado"
  }
}
```

Resposta: `answer`, `mode` (`knowledge`, `model`, `local-calculation`, `educational-reference` ou `unavailable`), `module`, `knowledge` (IDs recuperados) e `needs_review`. `GET /health` também informa `model_configured`, que indica se a chave do provedor foi configurada; não testa a disponibilidade do provedor.

O endpoint `GET /health` não exige autenticação. Sem `MODEL_API_KEY`, a API usa a base local confirmada e resolve expressões aritméticas simples com uma calculadora local segura. Perguntas abertas fora dessas capacidades retornam `mode: unavailable`. Com modelo configurado, a chave permanece no servidor. A pesquisa externa ainda não foi migrada. O backend do Trilha 4X4 já possui adaptador para `/v1/chat`, mas a integração real entre os dois servidores e o Groq ainda precisa ser validada.

**Segurança:** nunca exponha `VERIS_API_KEY` no JavaScript do navegador ou no aplicativo móvel. O backend do Trilha 4X4 autentica seus usuários e chama a VERIS-AI pelo servidor quando configurado. Para acesso externo, configurar HTTPS, autenticação e proteção adicional de infraestrutura; por padrão o serviço inicia em `127.0.0.1`. Nunca publique a interface sem autenticação.

## Conectar ao Trilha 4X4 no mesmo computador

No `.env` privado do Trilha 4X4, configure `VERIS_URL=http://127.0.0.1:3100` e `VERIS_API_KEY` com a mesma chave definida no `.env` privado da VERIS-AI. Inicie o Trilha na porta 3000 e a VERIS-AI na porta 3100 em terminais separados. O adaptador do Trilha aguarda até 20 segundos e usa o chat anterior se a VERIS-AI falhar. **A execução conjunta no PC, o Groq real e os testes no celular ainda estão pendentes.**

## Erros e limites

- `401`: chave da API ausente ou incorreta.
- `400`: pergunta ou JSON inválido, ou entrada recusada pela segurança; consulte o campo `safety` quando presente.
- `429`: limite de requisições atingido.
- `502`: falha ao acessar a VERIS-AI ou o modelo externo.
- Para dúvidas técnicas de veículos, a base confirmada tem prioridade; não trate entradas pendentes como validadas.


## Feedback de qualidade (consentimento explícito)

`POST /v1/feedback` exige a chave da API e um JSON como `{"knowledge_id":"offroad-001","reason":"incorrect","consent":true}`. Motivos permitidos: `helpful`, `incorrect`, `incomplete`, `unsafe` e `outdated`. O sistema armazena somente o ID da entrada, o motivo e a data; ignora textos livres e não publica correções automaticamente. O registro permanece `PENDING_REVIEW`.

`GET /v1/feedback` exige `VERIS_OWNER_API_KEY` (chave distinta, com pelo menos 32 caracteres), definida somente no `.env` privado. Sem essa chave, não há consulta administrativa. O arquivo local pode ser configurado por `VERIS_FEEDBACK_FILE`; proteja o diretório e defina política de retenção antes de operar publicamente. Ainda não há botão de feedback na interface nem painel de revisão.

## Testes

`npm.cmd run check` executa os testes da base e da API. A automação do GitHub também executa esses testes a cada alteração na branch principal.

## Modo de testes da base 4X4

As 36 respostas autorizadas pelo responsável estão marcadas `TESTE_NAO_VALIDADA`. Para incluí-las nas respostas apenas em ambiente de testes, configure `VERIS_ENABLE_TEST_KNOWLEDGE=true` no `.env` privado e reinicie a VERIS-AI. Sem essa variável, a API recupera somente entradas confirmadas e orientações gerais. A resposta mantém `knowledge[].status` para identificar entradas experimentais. Não exponha este modo ao público antes da revisão técnica.
