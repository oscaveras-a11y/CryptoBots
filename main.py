"""Research CLI: indicator evolution is the default engine, paper only."""
import argparse
import json
from trader.market import Market, align_by_time, resample
from trader.indicator_evolution import (STRATEGIES, evolve_indicators, research_plan,
                                        validate_genome)
from trader.evolution import evolve


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--capital",type=float,default=100)
    p.add_argument("--bots",type=int,default=20)
    p.add_argument("--generations",type=int,default=8)
    p.add_argument("--seed",type=int,default=42)
    p.add_argument("--symbols",type=int,default=8)
    p.add_argument("--engine",choices=("indicators","legacy"),default="indicators")
    p.add_argument("--strategy",choices=STRATEGIES,default="preset")
    p.add_argument("--timeframe",type=int,default=6,choices=(1,2,4,6,12))
    p.add_argument("--days",type=int,default=180,
                   help="Dias de historico para treino e validacao (padrao 180)")
    a=p.parse_args()
    if a.capital<=0 or a.bots<2 or a.generations<1 or a.symbols<1 or a.days<8:
        p.error("Parametros invalidos")
    market=Market()
    symbols=market.select_symbols(a.symbols)
    if a.engine=="indicators":
        data=align_by_time({s:resample(market.ohlcv(s,a.days*24),a.timeframe) for s in symbols})
        fixed,plan=research_plan(a.strategy)
        report=(validate_genome(data,fixed,a.capital) if fixed is not None else
                evolve_indicators(data,a.capital,a.bots,a.generations,a.seed,**plan))
        report["strategy"]=a.strategy
        report["timeframe_hours"]=a.timeframe
    else:
        data={s:market.closes(s,350) for s in symbols}
        report=evolve(data,a.capital,a.bots,a.generations,a.seed)
    report["engine"]=a.engine
    report["symbols"]=symbols
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
