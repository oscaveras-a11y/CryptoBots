"""Offline research pipeline: evolve genomes, validate, replay approved candidates.

No network, no real orders. Inputs are completed OHLCV candles, one shared
virtual quote balance. Holdout is not used to choose the genome.
"""
from dataclasses import asdict
from decimal import Decimal
from trader.evolution import Genome, evolve
from trader.strategy import trading_signal
from trader.capital import SharedCapital


def evaluate(candles_by_symbol, capital="100", bots=20, generations=8, seed=42,
             min_validation_return=0.0):
    if not candles_by_symbol:
        raise ValueError("No candles")
    if Decimal(str(capital)) <= 0:
        raise ValueError("Capital must be positive")
    if len({len(c) for c in candles_by_symbol.values()}) != 1:
        raise ValueError("Aligned equal-length candle histories required")
    data = {}
    for symbol, candles in candles_by_symbol.items():
        if len(candles) < 120:
            raise ValueError("At least 120 completed candles required")
        data[symbol] = [float(c.close) for c in candles]
    result = evolve(data, float(capital), bots=bots, generations=generations, seed=seed)
    winner = Genome(**result["winner"])
    holdout = result["out_of_sample"]
    # Strict: all symbols must pass; otherwise reject, not optimize on holdout.
    approved = all(not v["dead"] and v["trades"] > 0 and
                   v["equity"] >= float(capital)*(1+min_validation_return)
                   for v in holdout.values())
    result["approved_for_paper"] = approved
    result["approval_rule"] = "Every holdout: >= target, >=1 trade, no risk death"
    if not approved:
        return {"research": result, "paper": None, "status": "REJECTED_HOLDOUT"}

    # One global paper cash pool. Do not treat each symbol as its own 100 units.
    pool = SharedCapital(capital)
    positions = {}
    logs = []
    start = max(int(len(c)*.7) for c in candles_by_symbol.values())
    # Equal length (checked above) keeps this offline replay chronologically aligned.
    total = len(next(iter(candles_by_symbol.values())))
    symbols = sorted(candles_by_symbol)
    for i in range(start, total):
        for symbol in symbols:
            candles = candles_by_symbol[symbol]
            price = Decimal(str(candles[i].close))
            signal = trading_signal(candles[:i+1],fast=winner.fast,slow=winner.slow)
            if symbol in positions:
                pos = positions[symbol]
                stop = price <= pos["entry"]*(1-Decimal(str(winner.stop)))
                take = price >= pos["entry"]*(1+Decimal(str(winner.take)))
                if signal["action"] == "SELL" or stop or take:
                    # Virtual 0.1% sell fee and 0.05% adverse slippage.
                    proceeds = pos["quantity"]*price*Decimal("0.9985")
                    pool.credit_sell(proceeds)
                    logs.append({"symbol":symbol,"side":"SELL","proceeds":str(proceeds)})
                    del positions[symbol]
            elif signal["action"] == "BUY":
                try:
                    token = pool.reserve(symbol)
                except ValueError:
                    continue
                # Virtual 0.1% buy fee and 0.05% adverse slippage.
                qty = token.amount*Decimal("0.999")/(price*Decimal("1.0005"))
                pool.commit_buy(token.id,token.amount)
                positions[symbol] = {"quantity":qty,"entry":price}
                logs.append({"symbol":symbol,"side":"BUY","cost":str(token.amount)})
    last_prices = {s:Decimal(str(c[-1].close)) for s,c in candles_by_symbol.items()}
    equity = Decimal(pool.snapshot()["free"]) + sum(
        p["quantity"]*last_prices[s]*Decimal("0.9985") for s,p in positions.items())
    return {
        "status":"PAPER_APPROVED",
        "research":result,
        "paper":{"equity":str(equity),"cash":pool.snapshot()["free"],
                 "positions":{s:{"quantity":str(p["quantity"]),"entry":str(p["entry"])}
                              for s,p in positions.items()},
                 "trades":logs,"quote_currency":"VIRTUAL"},
        "warning":"Offline simulation only. Holdout reused for replay; not independent live evidence."
    }
