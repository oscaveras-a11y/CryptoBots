# Operação da VERIS central pessoal

Referência atual: README.md. Não iniciar legacy-server.js em produção.

- Node.js 22+; `npm run setup` cria a senha com entrada oculta e mantém credenciais no .env ignorado pelo git.
- `npm start` inicia a aplicação em loopback. Acesso remoto somente via HTTPS, com NODE_ENV=production, porta privada e proxy sob controle do proprietário.
- Um processo por banco. Dados JSON privados em data/business.json; backup por /api/export após login ou cópia com o servidor parado.
- Em caso de interrupção inesperada, confirme que nenhum processo usa o banco antes de remover o arquivo .lock. Preserve o banco e restaure backup se o JSON estiver inválido; a aplicação não substitui dados corrompidos por um banco vazio.
- Rotinas só executam com o processo ligado, geram rascunhos/relatórios e registram falhas. Reinício respeita next_run; uma tarefa vencida executa uma vez, sem reproduzir todas as execuções perdidas.
- Credenciais dos provedores não são enviadas ao navegador ou incluídas no backup. Apenas contas gratuitas explicitamente confirmadas são habilitadas. A VERIS não verifica o faturamento externo.
- ChatGPT/Codex externos não são conectados por assinatura. OpenAI, Grok, Claude, postagens automáticas, mensagens externas e gasto em campanhas permanecem desativados.
- O histórico contém dados pessoais e pode ser enviado ao provedor para contexto. Restrinja o acesso ao computador e aos backups.
