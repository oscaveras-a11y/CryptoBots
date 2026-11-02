"""The fast precomputed backtest must match the original per-candle computation."""
import math
import random
import unittest

from trader.indicator_evolution import Features, IndicatorGenome, replay, evolve_indicators
from trader.knowledge import market_profile
from trader.strategy import Candle, trading_signal


def random_candles(n, seed, with_open=True):
    rng = random.Random(seed)
    price, out = 100.0, []
    for i in range(n):
        open_ = price
        close = max(1.0, open_ * (1 + rng.gauss(0, .012) + .004 * math.sin(i / 9)))
        high = max(open_, close) * (1 + abs(rng.gauss(0, .004)))
        low = min(open_, close) * (1 - abs(rng.gauss(0, .004)))
        volume = rng.uniform(50, 150) * (3 if rng.random() < .05 else 1)
        out.append(Candle(close, high, low, volume,
                          open=open_ if with_open else None, open_time=i * 3_600_000))
        price = close
    return out


def slow_reference_replay(candles, genome, capital=100.0, start=None,
                          fee=.001, slippage=.0005, max_loss=.08):
    """Straightforward version: recompute indicators from candles[:i] every step."""
    start = max(51, genome.slow+2) if start is None else max(start, 51, genome.slow+2)
    cash, units, entry, round_trips = float(capital), 0.0, 0.0, 0
    peak, drawdown, stopped = float(capital), 0.0, False
    for i in range(start, len(candles)):
        price = candles[i].open if candles[i].open is not None else candles[i-1].close
        equity = cash+units*price*(1-fee-slippage)
        peak = max(peak, equity)
        drawdown = max(drawdown, 1-equity/peak)
        if equity <= capital*(1-max_loss):
            stopped = True
            if units:
                cash, units = units*price*(1-fee-slippage), 0
                round_trips += 1
            break
        previous = candles[:i]
        profile = market_profile(previous)
        signal = trading_signal(previous, fast=genome.fast, slow=genome.slow)["action"]
        if units and (price <= entry*(1-genome.stop) or price >= entry*(1+genome.take)
                      or signal == "SELL" or profile["rsi"] < genome.rsi_sell_min):
            cash, units = units*price*(1-fee-slippage), 0
            round_trips += 1
        elif (not units and signal == "BUY" and profile["rsi"] <= genome.rsi_buy_max
              and profile["atr_percent"] <= genome.max_atr_percent
              and profile["regime"] != "HIGH_VOLATILITY"):
            entry = price*(1+slippage)
            units, cash = cash*(1-fee)/entry, 0.0
    final = cash+units*candles[-1].close*(1-fee-slippage)
    return {"equity":round(final, 4), "round_trips":round_trips,
            "drawdown":round(drawdown, 5), "dead":stopped}


GENOMES = [IndicatorGenome(5, 15, 70, 30, 6, .02, .04),
           IndicatorGenome(8, 30, 75, 25, 9, .03, .08),
           IndicatorGenome(3, 7, 80, 20, 9, .01, .02),
           IndicatorGenome(12, 45, 60, 40, 4, .05, .1)]


class EquivalenceTests(unittest.TestCase):
    def test_features_match_original_indicators_every_candle(self):
        candles = random_candles(400, seed=3)
        f = Features(candles)
        for k in range(51, len(candles)+1):
            self.assertEqual(f.profile(k), market_profile(candles[:k]), k)
            for fast, slow in ((5, 15), (3, 7), (12, 45)):
                self.assertEqual(f.signal(k, fast, slow),
                                 trading_signal(candles[:k], fast=fast, slow=slow)["action"],
                                 (k, fast, slow))

    def test_replay_matches_reference(self):
        trades_seen = 0
        for seed in range(4):
            for with_open in (True, False):
                candles = random_candles(320, seed=seed, with_open=with_open)
                for genome in GENOMES:
                    for start in (None, 200):
                        fast = replay(candles, genome, start=start)
                        slow = slow_reference_replay(candles, genome, start=start)
                        for key in slow:
                            self.assertEqual(fast[key], slow[key], (seed, genome, start, key))
                        trades_seen += fast["round_trips"]
        self.assertGreater(trades_seen, 0, "test data must actually trade")

    def test_end_parameter_equals_slicing(self):
        candles = random_candles(300, seed=7)
        f = Features(candles)
        for genome in GENOMES:
            self.assertEqual(replay(candles, genome, features=f, end=250),
                             replay(candles[:250], genome))

    def test_fill_uses_next_candle_open(self):
        # Decision at step i only sees candles[:i]; fill price is candles[i].open.
        candles = random_candles(120, seed=1)
        f = Features(candles)
        self.assertEqual(f.exec_price[60], candles[60].open)
        no_open = random_candles(120, seed=1, with_open=False)
        self.assertEqual(Features(no_open).exec_price[60], no_open[59].close)

    def test_ninety_days_is_fast_enough(self):
        import time
        data = {s: random_candles(2160, seed=i) for i, s in enumerate(("AUSDT", "BUSDT"))}
        began = time.perf_counter()
        report = evolve_indicators(data, bots=12, generations=5, seed=1)
        self.assertLess(time.perf_counter()-began, 60)
        self.assertEqual(report["history_candles"], {"AUSDT": 2160, "BUSDT": 2160})
        self.assertEqual(len(report["walk_forward"]["AUSDT"]), 4)


if __name__ == "__main__":
    unittest.main()
