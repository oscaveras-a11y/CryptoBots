# ACTION: ferramentas locais do JARVIS

O CORE executa list-files, read-file e create-note com autorização local do proprietário. O painel inclui formulário ACTION e a API autenticada POST /api/action. O comando `npm run action -- caminho-da-tarefa.json` funciona sem chamar o modelo ou enviar conteúdo à internet.

Registre projetos locais em config/projects.json: {"projects":{"lab":"C:/caminho/do/projeto"}}. A pasta deve ser confiável e não pode ser um caminho de rede UNC ou dispositivo. Essas verificações não constituem uma sandbox do sistema operacional.

Crie uma autorização com `npm run action-access -- grant permissao.json`. O JSON deve conter actor, project, expiresAt (timestamp em milissegundos futuro), operations (["action-read","action-create"]), allowPaths (["notes/**"]) e denyPaths ([]). O comando retorna permissionId. A revogação usa `npm run action-access -- revoke ID Geral`. Não há endpoint HTTP para conceder permissões.

A tarefa JSON contém tool, project, permissionId e, para leitura/criação, path relativo. create-note requer content. Exemplo: {"tool":"create-note","project":"lab","permissionId":"ID","path":"notes/tarefa.md","content":"Minha nota"}. A pasta notes deve existir.

Leitura limitada a 20.000 bytes; criação apenas .txt/.md, sem sobrescrever. Listagem até 200 arquivos e 1.000 entradas examinadas, com indicador truncated. Segredos conhecidos, travessia de diretório, links simbólicos e nomes especiais do Windows são recusados. A nota é publicada inteira por link exclusivo; sistemas de arquivos sem suporte recusam a operação.

A auditoria armazena metadados de execução, sem conteúdo dos arquivos; auditRecorded indica se foi persistida. executed/verified indicam verificação da operação local, não qualidade semântica da nota. Não executa shell, instalação, comandos gerados ou ações externas.

Validação nesta máquina: 95 testes, 94 aprovados e um teste de link simbólico ignorado por limitação do Windows. A demonstração real criou, leu e listou uma nota em work/jarvis-lab.

O servidor antigo aberto em :3200 precisa ser reiniciado para carregar o painel atualizado. O reinício automático foi recusado pela revisão de aprovação; o CLI e a API em testes isolados foram verificados.
