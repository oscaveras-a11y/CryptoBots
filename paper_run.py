"""Deterministic offline paper replay with crash-safe snapshots; never places orders."""
import argparse
import json
import os
from decimal import Decimal
from pathlib import Path

from trader.execution import Limits, PaperPortfolio, dec
from trader.evolution import Genome

def replay(prices, genome, capital="100", max_allocation="0.10"):
    if not prices or len(prices) < genome.slow + 3:
        raise ValueError("Historico insuficiente")
    if any(dec(p) <= 0 for p in prices):
        raise ValueError("Precos devem ser positivos")
    limits = Limits(capital=dec(capital), max_allocation=dec(max_allocation))
    portfolio = PaperPortfolio(limits)
    symbol = "SIMUSDT"
    stopped = None
    last_price = dec(prices[genome.slow])
    entry = None
    for i in range(genome.slow, len(prices)):
        price = dec(prices[i])
        marks = {symbol: price}
        day = f"SIM-DAY-{i//24:06d}"
        last_price = price
        fast = sum(map(dec, prices[i-genome.fast:i])) / genome.fast
        slow = sum(map(dec, prices[i-genome.slow:i])) / genome.slow
        held = portfolio.holdings.get(symbol, Decimal(0)) > 0
        try:
            portfolio.check(marks, day)
        except RuntimeError as exc:
            stopped = str(exc)
            if held:
                portfolio.sell(symbol, price, marks, day)
            break
        if held and (fast <= slow or price <= entry*(1-dec(genome.stop)) or price >= entry*(1+dec(genome.take))):
            portfolio.sell(symbol, price, marks, day)
            entry = None
        elif not held and fast > slow:
            portfolio.buy(symbol, price, marks, day)
            entry = price
    return {
        "mode":"OFFLINE_PAPER",
        "quote_currency":"USDT_SIMULATED",
        "cash":str(portfolio.cash),
        "holdings":{k:str(v) for k,v in portfolio.holdings.items()},
        "equity":str(portfolio.equity({symbol:last_price})),
        "trades":portfolio.trades,
        "stopped":stopped,
        "warning":"Nao sao ordens reais nem resultados futuros. Nao e valor em BRL."
    }

def atomic_json(path, data):
    target = Path(path)
    target.parent.mkdir(parents=True,exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    with temporary.open("w",encoding="utf-8") as file:
        json.dump(data,file,indent=2,ensure_ascii=False)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary,target)

def main():
    p = argparse.ArgumentParser(description="Reproduzir mercado historico sem ordens reais")
    p.add_argument("--prices",required=True,help="JSON com lista de precos positivos")
    p.add_argument("--output",default="data/paper_result.json")
    p.add_argument("--capital",default="100")
    p.add_argument("--fast",type=int,default=8)
    p.add_argument("--slow",type=int,default=25)
    a = p.parse_args()
    if not 2 <= a.fast < a.slow:
        p.error("Janelas invalidas")
    values = json.loads(Path(a.prices).read_text(encoding="utf-8"))
    report = replay(values,Genome(a.fast,a.slow,.02,.04),a.capital)
    atomic_json(a.output,report)
    print(json.dumps({k:v for k,v in report.items() if k!="trades"},indent=2))

if __name__ == "__main__":
    main()
