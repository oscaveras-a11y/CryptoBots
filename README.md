# Robôs evolutivos de criptomoedas — IA-VERIS

Projeto Python com biblioteca padrão. **Somente simulação e Binance Spot Testnet.** Não executa ordens reais e não promete lucros.

## Windows: começar

Instale Python 3.11+ e execute no PowerShell, na pasta do projeto:

```powershell
python -m unittest discover -s tests -v
python main.py --capital 100 --bots 20 --generations 8 --seed 42
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

A ordem usa `/api/v3/order/test`: **é validada, mas não executada nem mesmo no saldo fictício**. O tamanho mínimo, precisão, filtros do par e conectividade devem ser verificados na corretora. Nenhuma URL de ordens reais foi implementada.

## Fiscal CPF — Brasil

`trader/fiscal.py` registra operações em SQLite com identificador único por corretora, fuso horário, quantidade, preço e taxa em BRL, separando dados simulados e reais. Pode exportar CSV mensal. **O módulo ainda não está integrado automaticamente aos fills e não calcula impostos, DARF, DeCripto ou declaração de IR.** A classificação tributária depende da legislação vigente, da corretora e do tipo de operação. Antes de negociar dinheiro real, conferir com contador familiarizado com criptoativos.

## Situação de entrega

- Implementados: backtest evolutivo, teste automatizado, consulta pública de candles, carteira virtual isolada, assinatura de API de teste, validação de ordem de teste, livro fiscal e CSV.
- Pendentes antes de uso real: execução contínua, sincronização de ordens, persistência da carteira, filtros de tamanho mínimo e precisão da corretora, reconciliação e recuperação após queda, proteção de credenciais, conversão cambial BRL, integração automática com livro fiscal, cálculo fiscal revisado e testes extensivos em condições adversas.
- Não forneça CPF, chave secreta nem credenciais reais em mensagens ou commits.
