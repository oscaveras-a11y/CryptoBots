# CODE — revisão das cinco etapas

Fluxo conectado ao CORE por `core.codeOperation({ operation, project, ... })`. A aplicação hospedeira cria `createCodeService({trustedProjects, generateChanges, verifyApproval, stageChanges, runChecks, createReview})` e injeta `codeService` no construtor `VerisCore`.

## Estado real
1. **Leitura e análise:** `project-reader.js` lê um diretório previamente autorizado pelo host, com limite de arquivos e bytes, exclusão de segredos, dependências e links simbólicos. `analyzeProject` executa apenas heurísticas simples.
2. **Motor de programação:** interface `generateChanges` definida, **nenhum modelo real conectado**. Sem adaptador retorna `requires_code_model_adapter`.
3. **Autorização:** staging exige identificador da proposta, escopo de arquivos e verificação independente `verifyApproval`. O host deve autenticar o usuário, verificar autorização persistida, expiração, consumo único e permissões; não aceitar apenas o JSON recebido.
4. **Ambiente isolado e testes:** interfaces `stageChanges` e `runChecks` definidas, **sem sandbox ou executor real**. O host deve fornecer isolamento robusto, proteção contra symlinks, rechecagem de hashes, timeouts e rollback. Nenhum comando arbitrário é executado pelo CODE.
5. **GitHub e revisão:** interface `createReview` definida, **sem conector de escrita real**. Nenhum merge automático.

## Testes
`cd veris-cyber && npm test`

Os arquivos `index.test.js` e `service.test.js` verificam controles e fluxos locais. Testes de integração reais ainda dependem de adaptadores e ambiente instalado. Não considerar as cinco etapas operacionalmente completas até validar as implementações do host.

## Regras permanentes
- Projeto JARVIS protegido: nunca escrever na versão principal automaticamente.
- Análise não implica permissão de execução.
- O CORE deve controlar o serviço; nunca expor os adaptadores diretamente a entrada não confiável.
- Revisão e merge são decisões humanas.
