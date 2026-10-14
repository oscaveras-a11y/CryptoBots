# Robôs Cripto Evolutivos

Substituição da VERIS por um laboratório de robôs de criptomoedas **100% simulado**. Não envia ordens reais, não usa API keys e não garante lucros.

## Executar (Python 3.10+)

```bash
python -m unittest discover -s tests -v
python main.py --capital 100 --bots 20 --generations 8 --seed 42
```

Consulta candles públicos da Binance para pares USDT com liquidez e filtros de negociação. Se a API estiver indisponível, falha explicitamente, sem fabricar preços. Capital em BRL é convertido apenas para avaliação virtual usando cotação pública USDT/BRL (BRLUSDT invertido); custos de câmbio reais não estão incluídos. **Nenhum valor real é movimentado.**

Cada robô possui estratégia de médias móveis, stop e take profit. Robôs que perdem acima do limite virtual morrem; vencedores geram descendentes mutados. Os dados são divididos cronologicamente em treino e validação, reduzindo (sem eliminar) sobreajuste. Resultados incluem taxas e slippage hipotéticos. O motor só negocia uma posição virtual por robô e utiliza spot, sem alavancagem.

**Avisos:** estratégias vencedoras podem perder no futuro; seleção baseada em retorno passado não assegura persistência. O projeto ainda não implementa integração fiscal operacional, execução real, reconciliação, persistência SQLite ou monitoramento contínuo. Para uso real será necessário validar regras tributárias brasileiras vigentes, mínimos de ordem, custódia, riscos, controles de acesso e testes em sandbox.
