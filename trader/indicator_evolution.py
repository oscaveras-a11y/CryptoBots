"""Evolution of indicator-based spot strategies, strictly offline.

Train on first 70% of CLOSED candles; holdout is evaluated once after
selection. Signals execute on NEXT candle close (simplified fill model).
No real orders and no guarantee of future returns.
"""
import random
from dataclasses import asdict, dataclass, replace
from trader.knowledge import market_profile
from trader.strategy import trading_signal


@dataclass(frozen=True)
class IndicatorGenome:
    fast: int
    slow: int
    rsi_buy_max: int
    rsi_sell_min: int
    max_atr_percent: float
    stop: float
    take: float


def _random(rng):
    fast = rng.randint(4, 18)
    return IndicatorGenome(fast, rng.randint(fast+5, 45),
                           rng.randint(55, 75), rng.randint(25, 45),
                           rng.uniform(2, 7), rng.uniform(.01, .04),
                           rng.uniform(.015, .08))


def _mutate(g, rng):
    fast = max(3, min(20, g.fast+rng.randint(-2, 2)))
    return IndicatorGenome(fast, max(fast+4,min(50,g.slow+rng.randint(-4,4))),
                           max(45,min(80,g.rsi_buy_max+rng.randint(-4,4))),
                           max(20,min(55,g.rsi_sell_min+rng.randint(-4,4))),
                           max(1,min(9,g.max_atr_percent*rng.uniform(.9,1.1))),
                           max(.005,min(.06,g.stop*rng.uniform(.9,1.1))),
                           max(.008,min(.12,g.take*rng.uniform(.9,1.1))))


def replay(candles, genome, capital=100.0, start=None,
           fee=.001, slippage=.0005, max_loss=.08):
    if capital <= 0 or len(candles) < 60:
        raise ValueError("Insufficient data or capital")
    start = max(51,genome.slow+2) if start is None else max(start,51,genome.slow+2)
    cash, units, entry, trades = float(capital), 0.0, 0.0, 0
    peak, drawdown, stopped = float(capital), 0.0, False
    # Only signals from candle i-1 may trigger a fill at candle i.
    for i in range(start,len(candles)):
        price = candles[i].close
        equity = cash+units*price*(1-fee-slippage)
        peak = max(peak,equity)
        drawdown = max(drawdown,1-equity/peak)
        if equity <= capital*(1-max_loss):
            stopped = True
            if units:
                cash=units*price*(1-fee-slippage)
                units=0
                trades+=1
            break
        previous = candles[:i]
        profile = market_profile(previous)
        signal = trading_signal(previous,fast=genome.fast,slow=genome.slow)
        if units and (price<=entry*(1-genome.stop) or
                      price>=entry*(1+genome.take) or
                      signal["action"]=="SELL" or
                      profile["rsi"]<genome.rsi_sell_min):
            cash=units*price*(1-fee-slippage)
            units=0
            trades+=1
        elif (not units and signal["action"]=="BUY"
              and profile["rsi"]<=genome.rsi_buy_max
              and profile["atr_percent"]<=genome.max_atr_percent
              and profile["regime"]!="HIGH_VOLATILITY"):
            entry=price*(1+slippage)
            units=cash*(1-fee)/entry
            cash=0.0
            trades+=1
    final=cash+units*candles[-1].close*(1-fee-slippage)
    return {"equity":round(final,4),"trades":trades,
            "drawdown":round(drawdown,5),"dead":stopped}


def evolve_indicators(data, capital=100.0, bots=20, generations=8, seed=42):
    if not data or bots<2 or generations<1:
        raise ValueError("Invalid research configuration")
    for candles in data.values():
        if len(candles)<180:
            raise ValueError("At least 180 completed candles required")
    rng=random.Random(seed)
    splits={s:int(len(c)*.7) for s,c in data.items()}
    population=[_random(rng) for _ in range(bots)]
    history=[]
    def score(g):
        results=[replay(c[:splits[s]],g,capital)
                 for s,c in data.items()]
        return sum(r["equity"]-capital*r["drawdown"]
                   -capital*.1*int(r["dead"]) for r in results)/len(results)
    for generation in range(generations):
        ranked=sorted(((score(g),g) for g in population),
                      key=lambda item:item[0],reverse=True)
        history.append({"generation":generation+1,
                        "best_train_score":round(ranked[0][0],4)})
        champions=[g for _,g in ranked[:max(1,bots//4)]]
        population=champions+[_mutate(rng.choice(champions),rng)
                              for _ in range(bots-len(champions))]
    winner=max(population,key=score)
    validation={s:replay(c,winner,capital,start=splits[s])
                for s,c in data.items()}
    approved=all(r["trades"]>0 and not r["dead"] and
                 r["equity"]>=capital for r in validation.values())
    return {"mode":"PAPER_ONLY","winner":asdict(winner),
            "generations":history,"out_of_sample":validation,
            "approved_for_paper":approved,
            "warning":"Indicator evolution is experimental. Holdout is not live evidence."}
