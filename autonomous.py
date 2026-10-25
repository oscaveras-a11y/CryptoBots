"""Autonomous PAPER-ONLY bot loop.

Uses closed market candles, periodically retrains indicator genomes, and
simulates orders. No exchange credentials, no production or testnet orders.
A process supervisor (Task Scheduler/systemd) is required for restart on crash.
"""
import argparse
import hashlib
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
from trader.decision_context import entry_context
from trader.market_memory import MarketMemory
from trader.paper_state import save as save_state, load as load_state

LOG = logging.getLogger("cryptobots.autonomous")


class AutonomousPaperBot:
    def __init__(self, market=None, symbols=None, capital="100",
                 bots=12, generations=5, seed=42, retrain_cycles=24,
                 state_path=None, memory_path=None):
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
        self.position_owners = {}
        if state_path:
            load_state(self,state_path)
        self.memory = MarketMemory(memory_path) if memory_path else None

    def checkpoint(self):
        if self.state_path:
            save_state(self,self.state_path)

    def remember_market(self, data):
        if self.memory is None:
            return
        btc = data.get("BTCUSDT")
        if btc is None:
            btc = self.market.ohlcv("BTCUSDT",350)
        btc_change = (btc[-1].close / btc[-25].close - 1) * 100
        for symbol,candles in data.items():
            marker = self.candle_key(candles)
            context = entry_context(symbol,candles,btc_change)
            self.memory.observe(symbol,marker,context["observation"],candles[-1].close)
            self.memory.settle_prior(symbol)

    @staticmethod
    def candle_key(candles):
        # Distinct completed candle fingerprint; no exchange timestamp in Candle.
        payload = repr([(c.close,c.high,c.low,c.volume) for c in candles[-2:]])
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def entry_price(self, symbol):
        """Recorded entry, else last paper BUY price; None means exit (fail closed).

        Never substitute the current price: that would silently disable stop/take.
        """
        entry=self.entries.get(symbol)
        if entry is not None:
            return float(entry)
        for trade in reversed(self.portfolio.trades):
            if trade.get("symbol")==symbol and trade.get("side")=="BUY":
                self.entries[symbol]=float(trade["price"])
                return self.entries[symbol]
        return None

    def cycle(self):
        # Fetch all histories before mutating any portfolio state.
        data = {symbol:self.market.ohlcv(symbol,350) for symbol in self.symbols}
        if self.genome is None or self.cycle_number % self.retrain_cycles == 0:
            report = evolve_indicators(data, capital=float(self.portfolio.limits.capital),
                                       bots=self.bots, generations=self.generations,
                                       seed=self.seed+self.cycle_number)
            self.last_report = report
            self.approved = report["approved_for_paper"]
            # Keep an existing exit policy for open positions even if new
            # entries fail validation. Never strand holdings without exits.
            if self.approved and not any(q > 0 for q in self.portfolio.holdings.values()):
                self.genome = IndicatorGenome(**report["winner"])
            elif self.approved and self.genome is None:
                raise RuntimeError("Open paper positions lack an exit policy; manual review required")
            elif not any(q > 0 for q in self.portfolio.holdings.values()):
                self.genome = None
            LOG.info("research approved=%s winner=%s",self.approved,report["winner"])
        self.cycle_number += 1
        if self.genome is None and any(q > 0 for q in self.portfolio.holdings.values()):
            raise RuntimeError("Open paper positions lack an exit policy; manual review required")
        if not self.approved and self.genome is None:
            self.remember_market(data)
            if self.memory is not None:
                for symbol,candles in data.items():
                    self.memory.decide(symbol,self.candle_key(candles),
                                       "WAIT","REJECTED_HOLDOUT",candles[-1].close)
            self.checkpoint()
            return {"status":"REJECTED_HOLDOUT","cycle":self.cycle_number,
                    "trades":[]}
        self.remember_market(data)
        prices = {symbol:candles[-1].close for symbol,candles in data.items()}
        today = datetime.now(timezone.utc).date().isoformat()
        decisions=[]
        btc_data = data.get("BTCUSDT")
        if btc_data is None and any(s != "BTCUSDT" for s in data):
            btc_data = self.market.ohlcv("BTCUSDT",350)
        btc_change = ((btc_data[-1].close / btc_data[-25].close - 1) * 100
                      if btc_data is not None else None)
        for symbol in sorted(data):
            candles=data[symbol]
            # Only act once on each completed hourly candle.
            # This is a research/paper approximation: fill at last closed price.
            marker = tuple((c.close,c.high,c.low,c.volume) for c in candles[-2:])
            if self.last_candle.get(symbol)==marker:
                continue
            self.last_candle[symbol]=marker
            self.checkpoint()
            profile=market_profile(candles)
            signal=trading_signal(candles,fast=self.genome.fast,slow=self.genome.slow)
            price=prices[symbol]
            position=self.portfolio.holdings.get(symbol,0)
            prior_count=len(decisions)
            if position:
                # Paper stop/take and sell signal; exits remain permitted if loss cap hit.
                # Entry basis is recorded on each buy for stop/take.
                entry=self.entry_price(symbol)
                if (entry is None or
                    price<=entry*(1-self.genome.stop) or
                    price>=entry*(1+self.genome.take) or
                    signal["action"]=="SELL" or
                    profile["rsi"]<self.genome.rsi_sell_min):
                    self.portfolio.sell(symbol,price,prices,today)
                    self.entries.pop(symbol,None)
                    self.position_owners.pop(symbol,None)
                    self.checkpoint()
                    decisions.append({"bot_id":"strategy:"+symbol,"symbol":symbol,"action":"SELL",
                                      "reason":"EXIT" if entry is not None else "MISSING_ENTRY_PRICE"})
            elif (self.approved and signal["action"]=="BUY" and
                  profile["rsi"]<=self.genome.rsi_buy_max and
                  profile["atr_percent"]<=self.genome.max_atr_percent and
                  profile["regime"]!="HIGH_VOLATILITY"):
                context = entry_context(symbol,candles,btc_change)
                if not context["allow_buy"]:
                    decisions.append({"bot_id":"strategy:"+symbol,"symbol":symbol,
                                      "action":"WAIT","reason":"MARKET_CONTEXT",
                                      "details":context["reasons"]})
                    if self.memory is not None:
                        self.memory.decide(symbol,self.candle_key(candles),
                                           "WAIT","MARKET_CONTEXT",price,
                                           {"reasons":context["reasons"]})
                    self.checkpoint()
                    continue
                try:
                    self.portfolio.buy(symbol,price,prices,today)
                    self.entries[symbol]=price
                    self.position_owners[symbol]="strategy:"+symbol
                    self.checkpoint()
                    decisions.append({"bot_id":"strategy:"+symbol,"symbol":symbol,"action":"BUY","reason":"CONFIRMED_SIGNAL"})
                except (ValueError,RuntimeError) as exc:
                    decisions.append({"symbol":symbol,"action":"WAIT","reason":str(exc)})
            if self.memory is not None:
                decision = decisions[-1] if len(decisions)>prior_count else {
                    "action":"WAIT","reason":"NO_ENTRY_OR_EXIT_SIGNAL"}
                self.memory.decide(symbol,self.candle_key(candles),
                                   decision["action"],decision["reason"],price,
                                   {"signal":signal,"profile":profile,
                                    "details":decision.get("details",[])})
            self.checkpoint()
        self.checkpoint()
        return {"status":"PAPER_ACTIVE" if self.approved else "EXIT_ONLY",
                "cycle":self.cycle_number,
                "equity":str(self.portfolio.equity(prices)),
                "decisions":decisions,"trades":self.portfolio.trades[-10:]}

    @staticmethod
    def seconds_until_next(interval, now=None, settle=20):
        """Wait so each cycle starts just after a candle closes (UTC boundary).

        A fixed sleep(interval) drifts and can act on a candle almost one hour old.
        """
        now=time.time() if now is None else now
        return interval-(now%interval)+settle

    def run(self, interval=3600, once=False, align=True):
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
            time.sleep(self.seconds_until_next(interval) if align else interval)


def main():
    parser=argparse.ArgumentParser(description="CryptoBots autonomous PAPER mode")
    parser.add_argument("--once",action="store_true")
    parser.add_argument("--interval",type=int,default=3600)
    parser.add_argument("--capital",default="100")
    parser.add_argument("--symbols",nargs="+",default=["BTCUSDT","ETHUSDT"])
    parser.add_argument("--memory",default="data/market-memory.sqlite3")
    parser.add_argument("--state",default="data/paper-state.json",
                        help="Persistent local paper-state path")
    args=parser.parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    bot=AutonomousPaperBot(symbols=args.symbols,capital=args.capital,
                           state_path=args.state,memory_path=args.memory)
    bot.run(interval=args.interval,once=args.once)


if __name__=="__main__":
    main()
