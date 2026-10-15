"""Autonomous PAPER-ONLY bot loop.

Uses closed market candles, periodically retrains indicator genomes, and
simulates orders. No exchange credentials, no production or testnet orders.
A process supervisor (Task Scheduler/systemd) is required for restart on crash.
"""
import argparse
import json
import logging
import os
import signal
import time
from datetime import datetime, timezone
from pathlib import Path

from trader.market import Market
from trader.execution import Limits, PaperPortfolio
from trader.indicator_evolution import evolve_indicators, IndicatorGenome
from trader.knowledge import market_profile
from trader.strategy import trading_signal
from trader.paper_state import save as save_state, load as load_state

LOG = logging.getLogger("cryptobots.autonomous")


class AutonomousPaperBot:
    def __init__(self, market=None, symbols=None, capital="100",
                 bots=12, generations=5, seed=42, retrain_cycles=24,
                 state_path=None):
        if bots < 2 or generations < 1 or retrain_cycles < 1:
            raise ValueError("Invalid evolution configuration")
        self.market = market if market is not None else Market()
        self.symbols = symbols or ["BTCUSDT", "ETHUSDT"]
        self.portfolio = PaperPortfolio(Limits(capital=__import__("decimal").Decimal(str(capital))))
        self.bots, self.generations, self.seed = bots, generations, seed
        self.retrain_cycles = retrain_cycles
        self.cycle_number = 0
        self.genome = None
        self.approved = False
        self.last_candle = {}
        self.last_report = None
        self.state_path = state_path
        self.entries = {}
        if state_path:
            load_state(self,state_path)

    def checkpoint(self):
        if self.state_path:
            save_state(self,self.state_path)

    def cycle(self):
        # Fetch all histories before mutating any portfolio state.
        data = {symbol:self.market.ohlcv(symbol,350) for symbol in self.symbols}
        if self.genome is None or self.cycle_number % self.retrain_cycles == 0:
            report = evolve_indicators(data, capital=float(self.portfolio.limits.capital),
                                       bots=self.bots, generations=self.generations,
                                       seed=self.seed+self.cycle_number)
            self.last_report = report
            self.approved = report["approved_for_paper"]
            self.genome = IndicatorGenome(**report["winner"]) if self.approved else None
            LOG.info("research approved=%s winner=%s",self.approved,report["winner"])
        self.cycle_number += 1
        if not self.approved or self.genome is None:
            self.checkpoint()
            return {"status":"REJECTED_HOLDOUT","cycle":self.cycle_number,
                    "trades":[]}
        prices = {symbol:candles[-1].close for symbol,candles in data.items()}
        today = datetime.now(timezone.utc).date().isoformat()
        decisions=[]
        for symbol in sorted(data):
            candles=data[symbol]
            # Only act once on each completed hourly candle.
            # This is a research/paper approximation: fill at last closed price.
            marker = tuple((c.close,c.high,c.low,c.volume) for c in candles[-2:])
            if self.last_candle.get(symbol)==marker:
                continue
            self.last_candle[symbol]=marker
            profile=market_profile(candles)
            signal=trading_signal(candles,fast=self.genome.fast,slow=self.genome.slow)
            price=prices[symbol]
            position=self.portfolio.holdings.get(symbol,0)
            if position:
                # Paper stop/take and sell signal; exits remain permitted if loss cap hit.
                # Entry basis is recorded on each buy for stop/take.
                entry=getattr(self,"entries",{}).get(symbol,price)
                if (price<=entry*(1-self.genome.stop) or
                    price>=entry*(1+self.genome.take) or
                    signal["action"]=="SELL" or
                    profile["rsi"]<self.genome.rsi_sell_min):
                    self.portfolio.sell(symbol,price,prices,today)
                    decisions.append({"symbol":symbol,"action":"SELL","reason":"EXIT"})
            elif (signal["action"]=="BUY" and
                  profile["rsi"]<=self.genome.rsi_buy_max and
                  profile["atr_percent"]<=self.genome.max_atr_percent and
                  profile["regime"]!="HIGH_VOLATILITY"):
                try:
                    self.portfolio.buy(symbol,price,prices,today)
                    if not hasattr(self,"entries"):
                        self.entries={}
                    self.entries[symbol]=price
                    decisions.append({"symbol":symbol,"action":"BUY","reason":"CONFIRMED_SIGNAL"})
                except (ValueError,RuntimeError) as exc:
                    decisions.append({"symbol":symbol,"action":"WAIT","reason":str(exc)})
            self.checkpoint()
        self.checkpoint()
        return {"status":"PAPER_ACTIVE","cycle":self.cycle_number,
                "equity":str(self.portfolio.equity(prices)),
                "decisions":decisions,"trades":self.portfolio.trades[-10:]}

    def run(self, interval=3600, once=False):
        if interval < 60:
            raise ValueError("Minimum polling interval is 60 seconds")
        while True:
            try:
                result=self.cycle()
                LOG.info("cycle %s",json.dumps(result,ensure_ascii=False))
            except Exception:
                LOG.exception("Cycle failed; no orders executed")
                if once:
                    raise
            if once:
                return result
            time.sleep(interval)


def main():
    parser=argparse.ArgumentParser(description="CryptoBots autonomous PAPER mode")
    parser.add_argument("--once",action="store_true")
    parser.add_argument("--interval",type=int,default=3600)
    parser.add_argument("--capital",default="100")
    parser.add_argument("--symbols",nargs="+",default=["BTCUSDT","ETHUSDT"])
    parser.add_argument("--state",default="data/paper-state.json",
                        help="Persistent local paper-state path")
    args=parser.parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    bot=AutonomousPaperBot(symbols=args.symbols,capital=args.capital,
                           state_path=args.state)
    bot.run(interval=args.interval,once=args.once)


if __name__=="__main__":
    main()
