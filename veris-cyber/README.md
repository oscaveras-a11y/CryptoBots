# VERIS CYBER

Módulo independente de auditoria de segurança para sistemas sob autorização.

## Estado
CORE e 12 agentes com API local autenticada; vários agentes ainda são componentes parciais. **Não executa invasões, varreduras de rede nem testes de carga.** A VERIS-AI original permanece inalterada.

## Executar
Requer Node.js 20 ou superior.

```bash
cd veris-cyber
npm run setup
npm test
npm start
```

API local em `http://127.0.0.1:3200` (configurável por `CYBER_PORT`).

- `GET /health`: status.
- `POST /api/audits`: registra uma auditoria demonstrativa, exigindo escopo e declaração de autorização; nenhum teste ativo é executado.

## Segurança e próximos passos
- A API exige autenticação por token. Ela permanece restrita ao loopback; não há suporte a exposição externa.
- Guardar autorização escrita, escopo e janela de testes antes de integrar scanners.
- Adicionar análise estática de código e relatórios com evidências.
- Nunca executar comandos sugeridos por um modelo de linguagem sem validação e aprovação.

## Motor de análise v1

`POST /api/engine/analyze` aceita JSON com `source` (código JavaScript), `filename`, `scope` e `authorized: true`. Retorna achados ordenados por severidade, pontuação heurística de risco, recomendações e limitações.

Exemplo de corpo:

```json
{
  "source": "eval(userInput);",
  "filename": "example.js",
  "scope": "código de laboratório próprio",
  "authorized": true
}
```

**Aviso:** o motor v1 é baseado em regras, não é um modelo de linguagem treinado nem uma IA generativa. A pontuação é heurística, não uma medida comprovada de explorabilidade. A API só escuta em localhost e exige uma credencial de acesso. Não exponha a porta na internet.

## Autenticação local

Execute `npm run setup` uma vez: ele cria `config/api-token` com 32 bytes aleatórios, sem imprimir nem retornar o segredo. O arquivo é ignorado pelo Git. Credenciais existentes válidas são preservadas; arquivos inválidos precisam ser corrigidos pelo proprietário.

`npm start` lê esse arquivo, ou usa `CYBER_API_TOKEN` quando configurado no ambiente. Sem uma credencial de 64 caracteres hexadecimais o serviço recusa iniciar. Todas as rotas `/api/*` exigem o cabeçalho `Authorization: Bearer <credencial>`; `/health` é público e não retorna dados privados. A credencial não substitui o escopo e a aprovação de tarefas. Requisições de navegador com origem externa e cabeçalhos Host externos são recusadas. Nenhum comando arbitrário foi habilitado.

No Windows, os modos POSIX de arquivo não garantem uma ACL privada: mantenha a pasta sob sua conta de usuário e confira as permissões locais. Não copie o token para conversas, logs, commits ou backups compartilhados.

## Estado verificado em 10/10/2026

A auditoria encontrou e corrigiu sintaxe/imports de testes, planejamento do MIND e acesso do CODE a arquivos negados pela permissão. O CODE confere o escopo antes de ler cada arquivo em inspeção, análise de segurança e propostas. O motor de programação continua próprio, determinístico e sem dependência de Ollama.

Ainda faltam sandbox de sistema operacional, executor de projetos não confiáveis, permissões persistentes completas, cancelamento em execução, aplicação de patches/rollback, escrita GitHub pelo agente, voz com binários reais, visão com mecanismo real, interface e modelo de linguagem próprio. A API de conversa com Groq continua uma integração opcional de texto; não é o motor CODE.

Os testes de links simbólicos são separados: no Windows sem privilégio de symlink eles ficam explicitamente pendentes, enquanto exclusão de segredos/dependências é testada normalmente.
