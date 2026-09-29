# API IA-VERIS

API independente com o primeiro módulo **VERIS 4X4**. As 49 entradas foram migradas do Trilha 4X4: 13 confirmadas e 36 aguardando revisão. O mecanismo usa somente as confirmadas.

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

Resposta: `answer`, `mode` (`knowledge` ou `model`), `module`, `knowledge` (IDs das fontes confirmadas) e `needs_review`.

O endpoint `GET /health` não exige autenticação. Sem `MODEL_API_KEY`, a API usa apenas a base confirmada. Com modelo configurado, a chave permanece no servidor. A pesquisa externa e a integração com o aplicativo ainda não foram migradas.

**Segurança:** nunca exponha `VERIS_API_KEY` no JavaScript do navegador ou no aplicativo móvel. O backend do Trilha 4X4 deverá autenticar seus usuários e chamar a VERIS pelo servidor. Para acesso externo, configurar HTTPS, autenticação e proteção adicional de infraestrutura; o serviço inicia apenas em `127.0.0.1`.

## Testes

`npm.cmd run check` executa os testes da base e da API. A automação do GitHub também executa esses testes a cada alteração na branch principal.
