# CODE local — propostas e revisão

O CORE coordena este fluxo através de `POST /api/code`. O motor próprio continua oferecendo `replace-literal`, `remove-trailing-whitespace` e `ensure-final-newline`. Não é um modelo generativo.

## Cadastro do projeto

Crie `veris-cyber/config/projects.json` localmente, usando caminhos absolutos:

```json
{"projects":{"meu-projeto":"C:/caminho/do/seu/projeto"}}
```

Essa configuração, as permissões e as cópias de revisão são ignoradas pelo Git. A pasta `veris-cyber/workspaces` deve ficar fora do projeto cadastrado; caminhos sobrepostos são recusados. Reinicie o servidor após cadastrar projetos. Sem configuração, o servidor continua funcionando e o CODE informa `requires_code_service`.

## Permissão local do proprietário

Crie um JSON de permissão com seu nome em `actor`, projeto cadastrado, operações, caminhos permitidos/negados e `expiresAt` (timestamp Unix em milissegundos; futuro, no máximo 24 horas). Exemplo de estrutura, substituindo o timestamp por um valor válido:

```json
{
  "actor":"proprietario",
  "project":"meu-projeto",
  "operations":["inspect","propose","stage","describe","rollback"],
  "allowPaths":["src/**"],
  "denyPaths":["src/privado.js"],
  "expiresAt":0
}
```

Em `veris-cyber`, execute `npm run code-access -- grant caminho/da/permissao.json`. O comando retorna `permissionId`. Não há endpoint HTTP de concessão. Para revogar: `npm run code-access -- revoke ID proprietario`. Permissões e revogações persistem após reiniciar; existe auditoria local limitada aos últimos 1.000 eventos. Um arquivo `.lock` que sobrar após uma falha bloqueia novas gravações: após encerrar os processos, o proprietário deve remover esse arquivo para recuperar o acesso.

## Propor

Todas as chamadas exigem `Authorization: Bearer <token local>` e JSON. Exemplos de corpos para `/api/code`:

```json
{"operation":"inspect","project":"meu-projeto","permissionId":"ID"}
```

```json
{
  "operation":"propose","project":"meu-projeto","permissionId":"ID",
  "instruction":"Corrigir o literal",
  "options":{"operation":"replace-literal","path":"src/app.js","from":"const n=1;","to":"const n=2;"}
}
```

Revise `changes` e `proposalId`. Propostas ficam em memória por 15 minutos, até 100 entradas; após reiniciar, proponha novamente. Nada é escrito no projeto de origem.

## Aprovar e criar cópia

Após revisar, crie um JSON local:

```json
{"actor":"proprietario","project":"meu-projeto","operation":"stage","proposalId":"HASH_DA_PROPOSTA","branch":"jarvis/minha-correcao","paths":["src/app.js"],"expiresAt":0}
```

Use validade futura de no máximo uma hora. Execute `npm run code-access -- approve caminho/da/aprovacao.json` e use o `approvalId` retornado:

```json
{"operation":"stage","project":"meu-projeto","permissionId":"ID","proposalId":"HASH_DA_PROPOSTA","approvalId":"APROVACAO_ID"}
```

A aprovação é de uso único, vinculada ao projeto, operação, hash, branch e caminhos. `main` e `master` são recusadas. O nome da branch registra a intenção de revisão: **este fluxo não cria nem publica uma branch Git**. Um erro após consumir aprovação exige uma nova aprovação.

O retorno contém `reviewReference`. A cópia fica em `workspaces/ID/files` e contém **somente os arquivos alterados**, não um projeto executável completo. O manifesto conserva conteúdos anteriores e hashes. A publicação da cópia usa rename após preparação; baselines desatualizadas recusam o staging. Mantenha essa pasta privada: ela contém código autorizado e versões anteriores.

```json
{"operation":"describe","project":"meu-projeto","permissionId":"ID","reviewReference":"REVIEW_ID"}
```

`describe` exige permissão para todos os caminhos antes de devolver seu conteúdo.

## Rollback

Aprove localmente `operation: "rollback"` com `reviewReference`, `paths`, `project`, `actor` e validade. Depois:

```json
{"operation":"rollback","project":"meu-projeto","permissionId":"ID","reviewReference":"REVIEW_ID","approvalId":"APROVACAO_ROLLBACK_ID"}
```

O rollback restaura a cópia, preservando o projeto original. Modificações externas conflitantes são recusadas. A checagem de todos os arquivos acontece antes de escrever; uma interrupção no meio da restauração permite nova tentativa com aprovação renovada. Não existe garantia de transação de filesystem contra perda de energia.

## Execução e limites

`test` continua retornando `requires_trusted_test_adapter`: não há subprocesso nem shell habilitado para projetos não confiáveis. Cópias de revisão isolam alterações, não constituem sandbox de execução. GitHub, microfone, modelos de voz/visão e modelo neural próprio ainda exigem integrações e validação.

Configuração, autoridade e workspaces pertencem ao proprietário local. Os modos POSIX não garantem ACL privada no Windows. O controle por caminhos não protege contra outro processo malicioso com a mesma conta que altere diretórios durante operações; não use projetos ativamente hostis nesse ambiente.
