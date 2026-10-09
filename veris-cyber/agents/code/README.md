# CODE — status e testes com Codex

Implementado nesta fase: leitura de arquivos fornecidos explicitamente, validação de caminhos, limites de tamanho, verificações heurísticas com localização, propostas com hash SHA-256 de base, e uma interface de staging que exige aprovação específica por proposta/projeto/branch/arquivos. O agente **não** recebe acesso direto ao disco, terminal ou GitHub. Operações desconhecidas não executam nada.

## Limitações e itens ainda necessários

- O analisador é heurístico, não substitui ESLint, Semgrep, testes ou auditoria de segurança.
- Não existe modelo de programação conectado, nem indexação de repositórios grandes.
- O adaptador `stageChanges` ainda deve ser implementado em workspace isolado, com validação independente da autorização, revisão de hashes, proteção contra symlinks e rollback.
- Não há executor de comandos/testes isolado nem conector GitHub de escrita no CODE.
- O CORE ainda não tem um fluxo de aprovação persistente para esse agente. A proteção de execução depende de manter os adaptadores ausentes até isso estar pronto.
- Os testes automatizados foram adicionados, mas não foram executados nesta sessão.

## Teste inicial com Codex

No Codex, abra a branch `feature/veris-cyber` do repositório `oscaveras-a11y/IA-VERIS`. Rode `cd veris-cyber && npm test` e peça uma revisão de segurança dos arquivos `agents/code/index.js` e `agents/code/index.test.js`. Não autorize escrita na branch principal. Solicite ao Codex que implemente em branch isolada as partes restantes (indexação, analisadores, modelo, workspace isolado, execução controlada de testes, revisão GitHub) com testes E2E e revisão humana antes do merge.
