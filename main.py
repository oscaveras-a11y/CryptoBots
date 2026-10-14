"""Research CLI: indicator evolution is the default engine, paper only."""
import argparse
import json
from trader.market import Market
from trader.indicator_evolution import evolve_indicators
from trader.evolution import evolve


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--capital",type=float,default=100)
    p.add_argument("--bots",type=int,default=20)
    p.add_argument("--generations",type=int,default=8)
    p.add_argument("--seed",type=int,default=42)
    p.add_argument("--symbols",type=int,default=8)
    p.add_argument("--engine",choices=("indicators","legacy"),default="indicators")
    a=p.parse_args()
    if a.capital<=0 or a.bots<2 or a.generations<1 or a.symbols<1:
        p.error("Parametros invalidos")
    market=Market()
    symbols=market.select_symbols(a.symbols)
    if a.engine=="indicators":
        data={s:market.ohlcv(s,350) for s in symbols}
        report=evolve_indicators(data,a.capital,a.bots,a.generations,a.seed)
    else:
        data={s:market.closes(s,350) for s in symbols}
        report=evolve(data,a.capital,a.bots,a.generations,a.seed)
    report["engine"]=a.engine
    report["symbols"]=symbols
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
