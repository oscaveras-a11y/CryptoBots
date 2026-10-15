"""Atomic JSON snapshots for the autonomous PAPER portfolio.

Never stores credentials. Writes replace atomically; malformed state fails closed.
"""
import json
import os
import tempfile
from decimal import Decimal
from pathlib import Path

from trader.indicator_evolution import IndicatorGenome


def save(bot, path):
    target=Path(path)
    target.parent.mkdir(parents=True,exist_ok=True)
    p=bot.portfolio
    payload={
        "schema":1,"mode":"PAPER_ONLY",
        "symbols":bot.symbols,"initial_capital":str(p.limits.capital),
        "cash":str(p.cash),"holdings":{k:str(v) for k,v in p.holdings.items()},
        "start_of_day":str(p.start_of_day),"day":p.day,
        "trades":p.trades,"position_owners":bot.position_owners,"entries":{k:str(v) for k,v in getattr(bot,"entries",{}).items()},
        "cycle_number":bot.cycle_number,"approved":bot.approved,
        "genome":vars(bot.genome) if bot.genome else None,
        "last_candle":{k:list(v) for k,v in bot.last_candle.items()}
    }
    fd,name=tempfile.mkstemp(prefix=".cryptobots-",suffix=".tmp",dir=target.parent)
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as stream:
            json.dump(payload,stream,ensure_ascii=False,allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name,target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def load(bot, path):
    target=Path(path)
    if not target.exists():
        return False
    with target.open(encoding="utf-8") as stream:
        state=json.load(stream)
    if (state.get("schema")!=1 or state.get("mode")!="PAPER_ONLY"
        or state.get("symbols")!=bot.symbols
        or state.get("initial_capital")!=str(bot.portfolio.limits.capital)):
        raise ValueError("Incompatible paper state; refusing to start")
    p=bot.portfolio
    cash=Decimal(state["cash"])
    holdings={k:Decimal(v) for k,v in state["holdings"].items()}
    if cash<0 or any(v<0 for v in holdings.values()):
        raise ValueError("Invalid paper balances")
    p.cash=cash
    p.holdings=holdings
    p.start_of_day=Decimal(state["start_of_day"])
    p.day=state["day"]
    p.trades=state["trades"]
    bot.entries={k:float(v) for k,v in state["entries"].items()}
    bot.position_owners=state.get("position_owners",{})
    bot.cycle_number=int(state["cycle_number"])
    bot.approved=bool(state["approved"])
    bot.genome=IndicatorGenome(**state["genome"]) if state["genome"] else None
    bot.last_candle={k:tuple(tuple(x) for x in v) for k,v in state["last_candle"].items()}
    return True
