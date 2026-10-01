# Migração para a central pessoal

O Trilha 4X4 continua independente; este commit modifica apenas IA-VERIS.

O servidor principal agora é a central de negócios, versão 2. `legacy-server.js` preserva a implementação anterior e `public/legacy.html` sua interface. Os conhecimentos antigos permanecem em `knowledge/`, mas não orientam automaticamente o chat de negócios.

1. Faça backup do `.env` e de `data/` em local privado.
2. Atualize o código e execute `npm run setup` para criar a senha privada.
3. Transfira sua chave gratuita da Groq de MODEL_API_KEY para GROQ_API_KEY se desejar; nenhuma transferência automática é realizada. Confirme o plano sem faturamento e configure GROQ_FREE_TIER_CONFIRMED=true.
4. Configure Gemini/local apenas se disponíveis. As variáveis MODEL_BASE_URL e MODEL_API_KEY não são usadas pelo novo servidor.
5. Execute `npm run check`, depois `npm start` e faça login.
6. Cadastre um produto real, confira seu link e comissão no programa de afiliados, prepare a campanha e revise.

Os dados de feedback e medições da versão antiga permanecem nos arquivos originais. A nova central usa `data/business.json`. A chave padrão VERIS_API_KEY antiga não autoriza acesso aos dados de negócios. Nenhum conteúdo é publicado durante a migração.

Documentos antigos do 4X4 e plano-mestre descrevem a fase anterior. A referência atual é README.md e docs/api.md.
