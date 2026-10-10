# Privacidade local do JARVIS

O servidor passa a usar JARVIS_NETWORK_MODE=tor por padrão. Pesquisas Wikipedia/OpenAlex exigem SOCKS5 em 127.0.0.1:9050, com resolução DNS pelo proxy. Se Tor/curl estiver indisponível, a pesquisa falha; não há conexão direta alternativa. Redirecionamentos são recusados, destinos HTTPS limitados e resposta limitada a 1 MiB. O proxy deve ser um cliente Tor confiável; o aplicativo não comprova a identidade do processo na porta.

JARVIS_NETWORK_MODE=offline desabilita pesquisas. restricted permite pesquisas diretas e expõe IP ao provedor; somente uma configuração explícita do operador habilita esse modo.

Tor não garante anonimato. O provedor de internet pode detectar o uso de Tor. Consultas, contas e dados pessoais podem identificar o usuário. Circuitos são geridos por Tor, sem promessa de país específico ou troca de IP em cada pedido. Esta proteção cobre o transporte de pesquisa; não configura todos os aplicativos do computador.

Texto usa exclusivamente um endpoint local configurado por JARVIS_LOCAL_MODEL_ENDPOINT (http://127.0.0.1:PORTA/v1/chat/completions). Nenhum fallback de texto na nuvem. Sem modelo configurado, informa local_model_not_configured. O software de inferência e modelo ainda devem ser instalados separadamente; nenhum modelo próprio treinado é alegado.

O cliente Tor deve iniciar com ClientOnly 1, SocksPort 127.0.0.1:9050 e SafeSocks 1. Instalação portátil neste computador fica fora do Git, em work/runtime/tor. O pacote oficial foi conferido contra SHA-256 publicado, sem alegar verificação OpenPGP.
