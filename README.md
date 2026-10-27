# Robôs evolutivos de criptomoedas — IA-VERIS

Projeto Python com biblioteca padrão. **Somente simulação e Binance Spot Testnet.** Não executa ordens reais e não promete lucros.

## Windows: começar

Instale Python 3.11+ e execute no PowerShell, na pasta do projeto:

```powershell
python -m unittest discover -s tests -v
python main.py --capital 100 --bots 20 --generations 8 --seed 42 --days 90
```

O comando `main.py` baixa candles públicos da Binance, avalia estratégias por algoritmo evolutivo e imprime resultado de backtest com validação fora da amostra. Requer internet e acesso ao endpoint público. **O capital 100 é uma unidade virtual de cotação (USDT nos pares utilizados), NÃO uma conversão automática de R$100.** Cada estratégia é avaliada sobre o mesmo capital virtual, não há distribuição real do patrimônio entre bots.

## Carteira virtual com controle de risco

`trader/execution.py` inclui `PaperPortfolio`, com limite padrão de 10% de alocação por posição, 3% de perda diária, 8% de perda total, taxas e slippage aproximados. É um componente de simulação independente: ainda não está ligado ao algoritmo `evolve` ou a um loop automático de negociação. Os limites não garantem um teto absoluto de perda em mercados com saltos de preço.

## Binance Spot Testnet

1. Crie credenciais **somente de teste** no portal oficial Binance Spot Testnet.
2. No PowerShell da sessão atual (não envie chaves pelo chat e não salve no GitHub):

```powershell
$env:BINANCE_TESTNET_API_KEY='SUA_CHAVE_DE_TESTE'
$env:BINANCE_TESTNET_API_SECRET='SEU_SEGREDO_DE_TESTE'
python testnet.py --account
python testnet.py --test-order --symbol BTCUSDT --side BUY --quantity 0.001
```

Para conferir só a conexão (sem ordem), use `python testnet_connect.py`. Ele sincroniza o relógio com a Binance e, em caso de erro, mostra o código da Binance com uma dica. Os mais comuns são:

| Código | Significado |
|---|---|
| `-2015` | Chave inválida, sem permissão ou IP não liberado. Use chave da **Testnet**, não da conta real. |
| `-1022` | Secret errado. |
| `-1021` | Relógio fora de sincronia. O cliente ressincroniza e tenta de novo uma vez. |
| HTTP 451 | Região bloqueada para aquele IP. Os runners do GitHub ficam nos EUA, então isso é comum no workflow. |

No GitHub Actions, o motivo da falha aparece como anotação no resumo da execução. Os dados públicos de mercado tentam de novo em 429/5xx e usam o espelho `data-api.binance.vision` quando `api.binance.com` está bloqueado.

A ordem usa `/api/v3/order/test`: **é validada, mas não executada nem mesmo no saldo fictício**. O tamanho mínimo, precisão, filtros do par e conectividade devem ser verificados na corretora. Nenhuma URL de ordens reais foi implementada.

## Fiscal CPF — Brasil

`trader/fiscal.py` registra operações em SQLite com identificador único por corretora, fuso horário, quantidade, preço e taxa em BRL, separando dados simulados e reais. Pode exportar CSV mensal. **O módulo ainda não está integrado automaticamente aos fills e não calcula impostos, DARF, DeCripto ou declaração de IR.** A classificação tributária depende da legislação vigente, da corretora e do tipo de operação. Antes de negociar dinheiro real, conferir com contador familiarizado com criptoativos.

## Situação de entrega

- Implementados: backtest evolutivo, teste automatizado, consulta pública de candles, carteira virtual isolada, assinatura de API de teste, validação de ordem de teste, livro fiscal e CSV.
- Pendentes antes de uso real: execução contínua, sincronização de ordens, persistência da carteira, filtros de tamanho mínimo e precisão da corretora, reconciliação e recuperação após queda, proteção de credenciais, conversão cambial BRL, integração automática com livro fiscal, cálculo fiscal revisado e testes extensivos em condições adversas.
- Não forneça CPF, chave secreta nem credenciais reais em mensagens ou commits.

## Replay de carteira com arquivo local

Crie um arquivo `prices.json` contendo uma lista JSON com pelo menos 100 preços positivos, em ordem cronológica. Depois execute:

```powershell
python paper_run.py --prices prices.json --output data/paper_result.json --capital 100
```

O arquivo de saída é salvo atomicamente para evitar JSON incompleto. **Não é recuperação completa de posições**: o replay reinicia do começo e não faz ordens, nem sincroniza com corretora. A série é tratada como um único par virtual USDT. Para operar em múltiplos pares simultaneamente com capital compartilhado, é necessária uma camada adicional de orquestração.

## Capital compartilhado entre robôs

O módulo `trader/capital.py` implementa um coordenador de saldo compartilhado com `Decimal` e travamento por thread. Cada robô solicita uma reserva do saldo livre; compras confirmadas consomem essa reserva e vendas confirmadas devolvem o valor líquido ao caixa comum. Reservas canceladas liberam o valor. O padrão preserva 1% do saldo livre para custos e limita uma nova reserva a 25% do saldo livre no momento da solicitação (ambos configuráveis); não há divisão fixa por robô.

**Importante:** esse coordenador é **somente memória, para protótipo/simulação**. Ainda não é seguro para ordens reais: reinicializações perdem reservas, múltiplos processos não compartilham o travamento, e não existe conciliação automática de ordens abertas, saldos bloqueados, fills parciais, taxas em outros ativos ou execução idempotente. `commit_buy` e `credit_sell` só devem ser chamados após confirmação independente de execução pela corretora. A integração à Binance real permanece desabilitada; nunca cadastre chaves de produção para usar esse módulo sem a camada transacional persistente e os testes de reconciliação.

## Pesquisa de trading e sinais de mercado (experimental)

O módulo `trader/strategy.py` acrescenta uma estratégia interpretável com cruzamento de médias móveis, confirmação de volume e filtro de volatilidade. A função `trading_signal` recebe candles OHLCV **já fechados** e devolve `BUY`, `SELL` ou `WAIT` com motivo auditável. Ela **não está conectada ao motor evolutivo nem à execução real**: é um componente de pesquisa isolado. O filtro `eligible_market_order` faz somente uma verificação local parcial de `LOT_SIZE`, `MARKET_LOT_SIZE`, `MIN_NOTIONAL` e `NOTIONAL`; não substitui validação da corretora nem considera todas as regras dinâmicas.

Fundamentos: documentação oficial da Binance (https://github.com/binance/binance-spot-api-docs/blob/master/filters.md) e pesquisa sobre overfitting de backtests (https://doi.org/10.1016/j.knosys.2024.112477). Antes de selecionar parâmetros ou liberar capital, são necessários custos realistas, teste fora da amostra e validação em múltiplos períodos de mercado. Sinal técnico não é garantia de retorno.


## Execucao autonoma em simulacao

No Windows, use `iniciar-paper-windows.cmd` depois de instalar Python 3.11+.
O script reinicia o processo caso encerre, mas nao inicia automaticamente apos reiniciar o PC.
O saldo ficticio fica em `data/paper-state.json`, ignorado pelo Git.
Nao rode duas instancias simultaneas nem apague o estado para continuar uma carteira existente.
As operacoes sao apenas simuladas e nao garantem lucro. O saldo 100 e virtual, nao R$100.

### Como a estrategia e treinada e aprovada

- **Historico:** o bot usa **90 dias** de candles de 1h, cerca de 2.160 por moeda. Para mudar, use `--days`. A Binance entrega no maximo 1.000 candles por pedido, entao o historico e baixado em partes. Se faltar alguma hora na sequencia, o bot para em vez de treinar com dados furados. Quando ha mais de uma moeda, as series sao alinhadas pelo horario.
- **Divisao dos dados:** 70% para treinar, cerca de 63 dias. Os 30% finais, cerca de 27 dias, sao usados uma unica vez, depois da escolha.
- **Regra de aprovacao:**
  - na validacao, cada moeda precisa ter **pelo menos 3 operacoes completas**, terminar sem prejuizo e nao bater o limite de perda;
  - os mesmos 27 dias sao divididos em **4 janelas de cerca de 1 semana**: pelo menos 3 precisam ter operacao, pelo menos 3 precisam terminar sem prejuizo, e nenhuma pode bater o limite de perda;
  - o relatorio tambem mostra `buy_hold_equity`, quanto daria comprar e segurar a moeda no mesmo periodo. Serve so para comparacao.
- **Execucao igual no teste e no bot:** a decisao usa so candles fechados. No backtest, a execucao acontece na abertura do candle seguinte. No bot, o ciclo comeca 20 s depois da virada da hora e usa o preco atual da Binance.

E esperado que poucas estrategias sejam aprovadas. A regra existe para nao aprovar por sorte.

## Bot autonomo na Binance Spot Testnet (ordens ficticias)

```powershell
$env:BINANCE_TESTNET_API_KEY='SUA_CHAVE_DE_TESTE'
$env:BINANCE_TESTNET_API_SECRET='SEU_SEGREDO_DE_TESTE'
python autonomous.py --mode testnet --confirm-testnet
```

O bot envia ordens MARKET **so a Testnet**, com saldo ficticio. Nao existe endereco da Binance real no codigo. O estado fica em `data/testnet-state.json`, separado do estado da simulacao, e um arquivo nao pode ser usado no lugar do outro.

**Antes de enviar uma ordem:**
- confere os filtros do par na Testnet (tamanho minimo, casas decimais, valor minimo) e o saldo de USDT;
- nao compra se o preco da Testnet estiver mais de 2% longe do preco do mercado real. Vendas de saida nao sao bloqueadas por isso;
- respeita os mesmos limites de risco da simulacao: 10% por posicao, 3% de perda no dia e 8% de perda total.

**Durante o envio:**
- cada ordem leva um ID unico (`cb-B-BTCUSDT-<horario do candle>`);
- se a conexao cair ou a Binance responder erro 5xx, o bot **consulta esse ID** em vez de reenviar. Assim nunca compra em dobro;
- antes de enviar, o bot salva a ordem como pendente. Se o PC desligar no meio, o proximo ciclo confere o resultado na Binance e registra.

**Na carteira local:**
- ela so muda depois que a Binance confirma a execucao, com a quantidade, o valor e a taxa reais;
- compras usam um valor exato em USDT (`quoteOrderQty`). Vendas arredondam a quantidade para baixo, conforme o par;
- sobras abaixo do minimo da corretora sao zeradas localmente e registradas como `dust_written_off`.

**A cada ciclo:** o bot compara as posicoes locais com o saldo da Testnet. Se nao bater, ele para e avisa. Isso acontece, por exemplo, quando a Binance reinicia a Testnet, o que e periodico.

Os sinais vem dos dados publicos do mercado real. Os precos da Testnet podem ser diferentes, e o livro de ofertas e fino, entao o resultado na Testnet nao representa o resultado com dinheiro real.
