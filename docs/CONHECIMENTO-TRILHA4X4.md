# Conhecimento do Trilha 4X4 para VERIS-AI

Fonte: leitura do repositório `oscaveras-a11y/Trilha-4X4` em 29/09/2026: `README.md`, `MOBILE.md`, `package.json`, `server.js`, `public/modules/groups.js`, `trails.js`, `vehicles.js`, `trail-offline.js`, `trail-sos.js`, `map-safety.js` e `lib/ai-security.js`.

A base estruturada está em [knowledge/app-trilha4x4.json](../knowledge/app-trilha4x4.json). Seu propósito é permitir que VERIS-AI responda a perguntas gerais sobre o aplicativo. **Não** contém credenciais, informações pessoais, localizações reais, estado vivo de trilhas ou permissões de usuários. **Não** autoriza a IA a criar grupos, enviar SOS ou alterar rotas.

## Mapa funcional

- **Identidade e cadastro:** registro, login, sessão; perfis de usuários e veículos. Veículo com tipo, marca, modelo obrigatórios e placa opcional.
- **Grupos:** criar/editar, convites por código, participantes, administradores, passeios, confirmação e vínculo com trilhas. Fluxo de referência: grupo → passeio → confirmação → trilha → navegação.
- **Trilhas:** código `4X4-XXXXX`, acesso público/privado/convite, solicitações e aprovação; rota planejada livre com limite de 500 pontos; localização e histórico de percurso.
- **Navegação/offline:** dados e percurso salvos localmente para fallback; mapa-base completo offline ainda não está implementado. Há referências a tiles OpenFreeMap no README e OpenStreetMap em um módulo de mapa: não presumir que toda a interface usa um único provedor.
- **Segurança:** SOS por trilha, localização dos participantes, janela de segurança e atualizações em tempo real; sem rede, não prometer entrega de alertas. IA é auxiliar e não substitui o SOS.
- **Tempo real:** eventos SSE para notificações e grupos, além de atualizações de trilhas e rotas; requer teste em campo e background.
- **Plataformas:** PWA e preparação Capacitor Android/iOS; backend Node/Express com SQLite. Testes móveis e distribuição em lojas são etapas distintas.
- **IA atual do app:** `POST /api/chat` exige login, filtra entrada, usa conhecimento off-road confirmado, pesquisa externa opcional e modelo Groq opcional. O backend já possui adaptador para a VERIS-AI, mas a integração real ainda precisa ser validada.

## Fluxo de integração implementado (validação real pendente)

1. Backend do Trilha 4X4 autentica usuário e decide o escopo dos dados que pode enviar.
2. Backend envia `question` e `context` mínimo a `POST /v1/chat` com chave de servidor. Não enviar cookies de sessão nem chaves ao navegador.
3. VERIS-AI recupera a base técnica 4X4 e a base geral do app conforme o assunto; mantém as 36 respostas técnicas pendentes fora da recuperação.
4. Resposta retorna ao backend do app, que aplica suas próprias regras de acesso, limites e formato `reply` para o frontend.
5. Futuro: ferramentas específicas e autenticadas de consulta de trilhas, grupos, veículos e alertas, com autorização por usuário; nenhuma ação administrativa ou SOS autônomo.

## Limites e dúvidas em aberto

- Base estática não informa se o usuário entrou em um grupo, se a trilha está ativa ou onde estão participantes.
- A UI de grupos, a persistência de gravação, o funcionamento offline dos tiles, o GPS em background e a entrega SOS sem sinal exigem validação em dispositivo real.
- Informações de mecânica permanecem em `knowledge/offroad.json`; não misturar instruções técnicas pendentes com documentação do app.
