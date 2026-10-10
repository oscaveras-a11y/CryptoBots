# Conversa local MIND

Modelo instalado neste computador: Qwen2.5-0.5B-Instruct Q4_0 (428730208 bytes). É um modelo importado de Qwen; não é um modelo treinado pelo JARVIS. Motor de inferência portátil llama.cpp b11541, com backend compatível Ivy Bridge. Sem Ollama ou serviço pago.

O processo de inferência escuta apenas 127.0.0.1:3210, exige a credencial local em config/api-token, usa --offline, --no-agent e --no-webui. Contexto 1024 tokens, 2 threads, 1 slot, batch 64, CPU. Conversas não recebem ferramentas, arquivos de projeto ou memória automaticamente. Não há fallback na nuvem. Downloads de instalação contatam GitHub e Hugging Face; modo offline cobre inferência após o download, não o processo de instalação.

## Configuração e início

config/local-model.json é privado da máquina e ignorado pelo Git. Formato:

```json
{"endpoint":"http://127.0.0.1:3210/v1/chat/completions","model":"jarvis-local","executable":"C:/caminho/llama-server.exe","modelFile":"C:/caminho/model.gguf"}
```

Dentro de veris-cyber: npm run model:start inicia ou verifica o motor. Depois npm start inicia o JARVIS, que lê esse arquivo e autentica no modelo com a credencial local. Modelo e executáveis não fazem parte do repositório ou do ZIP de fontes. Se a porta do JARVIS já está ocupada, feche a instância antiga pelo controle de processos do Windows antes de iniciá-lo; o inicializador não encerra processos existentes.

JARVIS_LOCAL_MODEL_ENDPOINT e JARVIS_LOCAL_MODEL_NAME podem substituir o endpoint e nome; somente HTTP com host literal 127.0.0.1 e caminho /v1/chat/completions é aceito.

## Verificação real

Runtime SHA-256 cdc0535d11038bb337dfba3c15682050eaa9c07aedd0f915b4c09e8a8e8c0a5c.
Modelo SHA-256 7671c0c304e6ce5a7fc577bcb12aba01e2c155cc2efd29b2213c95b18edaf6ed.

CORE real com MIND: saudação em português em 5.8 segundos. API temporária offline conectada ao modelo: 7+5 respondeu 12 em 1.8 segundos; definição de variável em 3.7 segundos. Sem credencial: HTTP401 no modelo. RAM observada: cerca de 438MB de working set, com variação durante uso. Isso é teste de integração pequeno, não avaliação abrangente de qualidade.

A instância antiga do painel em 3200 ainda não foi reiniciada; uma revisão automática anterior bloqueou a parada/reinicialização de processos. O novo modelo está rodando e a integração foi comprovada por CORE e API isolados. Após reiniciar o JARVIS, /api/core/capabilities informa modelReady=true se configurado; isso indica configuração, não saúde do processo.

## Limitações

Modelo pequeno: respostas podem ser incorretas ou mal formuladas. Respostas são limitadas a192tokens; contexto1024tokens limita pedidos longos. Não há histórico de conversa neural por sessão nesta versão; cada pedido contém instrução de sistema e a mensagem atual. MEMORY armazena separadamente somente os registros admitidos por seus fluxos. Privacidade local não protege contra outros programas com acesso à mesma conta do Windows.

Fontes oficiais: https://github.com/ggml-org/llama.cpp/releases/tag/b11541 e https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF .

## Conversar sem reiniciar o painel

Com o modelo rodando, use npm run chat -- "Olá, Jarvis" dentro de veris-cyber. Esse comando chama o MIND através do CORE diretamente, sem depender do servidor antigo em3200, sem pesquisar na internet ou executar ferramentas. Cada comando é uma conversa independente.
