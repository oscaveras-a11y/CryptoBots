"""Strategy families: entries, exits, no look-ahead, and integration with the bot."""
import os
import random
import sys
import tempfile
import unittest
from unittest.mock import patch

from trader.indicator_evolution import (Features, IndicatorGenome, _mutate, _random,
                                        evolve_indicators, replay)
from trader.strategies import KINDS, Position, Snapshot, exit_reason, wants_entry
from trader.strategy import Candle

sys.path.insert(0, os.path.dirname(__file__))
from test_backtest_equivalence import random_candles  # noqa: E402

H = 3_600_000


def series(closes, spread=.002):
    out = []
    for i, c in enumerate(closes):
        o = closes[i - 1] if i else c
        out.append(Candle(c, max(o, c) * (1 + spread), min(o, c) * (1 - spread), 100.0,
                          open=o, open_time=i * H))
    return out


def genome(kind, **genes):
    base = dict(fast=5, slow=20, rsi_buy_max=100, rsi_sell_min=0, max_atr_percent=50,
                stop=0.0, take=0.0, kind=kind)
    base.update(genes)
    return IndicatorGenome(**base)


class EntryExitTests(unittest.TestCase):
    def test_breakout_enters_on_new_high_and_exits_on_channel_low(self):
        closes = [100.0] * 80 + [100.0 + i for i in range(1, 6)]
        f = Features(series(closes))
        g = genome("breakout", channel=20, exit_channel=10, atr_stop=50)
        self.assertFalse(wants_entry(Snapshot(f, 80), g))  # flat: no breakout yet
        self.assertTrue(wants_entry(Snapshot(f, 81), g))   # first close above the channel
        falling = closes + [104.0 - 3 * i for i in range(1, 8)]
        f2 = Features(series(falling))
        position = Position(entry=101.0, highest=105.0, entry_atr=1.0)
        reasons = [exit_reason(Snapshot(f2, k), g, position, f2.exec_price[k])
                   for k in range(86, len(falling))]
        self.assertIn("CHANNEL_EXIT", reasons)

    def test_trend_trailing_stop_follows_the_high(self):
        g = genome("trend", trail=2.0, atr_stop=50)
        closes = [100 + i for i in range(60)]
        f = Features(series(closes))
        s = Snapshot(f, 60)
        position = Position(entry=100.0, highest=159.0, entry_atr=1.0)
        stop_level = 159.0 - 2.0 * s.atr()
        self.assertIsNone(exit_reason(s, g, position, stop_level + .01))
        self.assertEqual(exit_reason(s, g, position, stop_level - .01), "TRAILING_STOP")

    def test_mean_reversion_buys_dip_and_exits_at_mean_or_time(self):
        closes = [100.0 + (.3 if i % 2 else -.3) for i in range(60)] + [95.0]
        f = Features(series(closes, spread=.001))
        g = genome("mean_reversion", band_k=2.0, oversold=45, atr_stop=50, max_hold=3)
        s = Snapshot(f, len(closes))
        self.assertTrue(wants_entry(s, g))
        position = Position(entry=95.0, highest=95.0, entry_atr=1.0, held=3)
        self.assertEqual(exit_reason(s, g, position, 95.0), "TIME_STOP")
        position.held = 0
        recovered = Features(series(closes + [100.5]))
        self.assertEqual(exit_reason(Snapshot(recovered, len(closes) + 1), g, position, 100.5),
                         "MEAN_REACHED")

    def test_atr_stop_applies_to_every_new_family(self):
        f = Features(random_candles(120, seed=5))
        s = Snapshot(f, 120)
        for kind in ("trend", "breakout", "mean_reversion"):
            g = genome(kind, atr_stop=2.0)
            position = Position(entry=100.0, highest=100.0, entry_atr=1.0)
            self.assertEqual(exit_reason(s, g, position, 97.9), "ATR_STOP", kind)

    def test_long_trend_filter_blocks_entries_below_it(self):
        closes = [200 - i for i in range(150)] + [60 + 5 * i for i in range(1, 4)]
        f = Features(series(closes))
        g = genome("breakout", channel=10, exit_channel=5, trend_len=100)
        self.assertFalse(wants_entry(Snapshot(f, len(closes)), g))
        self.assertTrue(wants_entry(Snapshot(f, len(closes)), genome("breakout", channel=10,
                                                                     exit_channel=5)))


class NoLookAheadTests(unittest.TestCase):
    def test_decisions_ignore_future_candles(self):
        candles = random_candles(400, seed=11)
        full, cut = Features(candles), Features(candles[:300])
        rng = random.Random(3)
        for _ in range(20):
            g = _random(rng)
            for k in range(200, 300):
                self.assertEqual(wants_entry(Snapshot(full, k), g), wants_entry(Snapshot(cut, k), g))

    def test_replay_up_to_end_matches_truncated_history(self):
        candles = random_candles(500, seed=12)
        f = Features(candles)
        rng = random.Random(4)
        for _ in range(12):
            g = _random(rng)
            self.assertEqual(replay(candles, g, features=f, end=400), replay(candles[:400], g))


class GenomeTests(unittest.TestCase):
    def test_random_and_mutated_genomes_are_valid_and_trade(self):
        candles = random_candles(1500, seed=13)
        f = Features(candles)
        rng = random.Random(5)
        traded = set()
        for _ in range(60):
            g = _mutate(_random(rng), rng)
            self.assertIn(g.kind, KINDS)
            self.assertLess(g.fast, g.slow)
            result = replay(candles, g, features=f)
            if result["round_trips"]:
                traded.add(g.kind)
        self.assertEqual(traded, set(KINDS))

    def test_old_saved_genome_loads_as_ma_cross(self):
        old = {"fast": 5, "slow": 15, "rsi_buy_max": 65, "rsi_sell_min": 30,
               "max_atr_percent": 5, "stop": .02, "take": .04}
        self.assertEqual(IndicatorGenome(**old).kind, "ma_cross")

    def test_evolution_can_be_restricted_to_kinds(self):
        data = {"AUSDT": random_candles(400, seed=1)}
        report = evolve_indicators(data, bots=6, generations=2, kinds=("breakout",))
        self.assertEqual(report["winner"]["kind"], "breakout")
        with self.assertRaises(ValueError):
            evolve_indicators(data, bots=4, generations=1, kinds=("magic",))

    def test_approval_requires_profit_not_just_break_even(self):
        import trader.indicator_evolution as ie
        flat = {"equity": 100.0, "trades": 10, "round_trips": 5, "winning_round_trips": 3,
                "drawdown": 0.0, "dead": False, "buy_hold_equity": 90.0, "time_in_market": .5}
        with patch.object(ie, "_replay", return_value=flat):
            report = evolve_indicators({"AUSDT": random_candles(300, seed=1)}, bots=2,
                                       generations=1)
        self.assertFalse(report["approved_for_paper"])


class BotIntegrationTests(unittest.TestCase):
    def make_bot(self, timeframe, path=None):
        from autonomous import AutonomousPaperBot

        class Market:
            def ohlcv(self, symbol, limit):
                return random_candles(800, seed=21)

        return AutonomousPaperBot(market=Market(), symbols=["BTCUSDT"], bots=2, generations=1,
                                  retrain_cycles=1000, state_path=path,
                                  timeframe_hours=timeframe)

    def test_bot_uses_four_hour_candles_and_persists_trailing_state(self):
        g = genome("trend", trail=3.0, atr_stop=10)
        approved = {"approved_for_paper": True, "winner": vars(g)}
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "state.json")
            bot = self.make_bot(4, path)
            seen = []

            def entry(snapshot, genome_):
                seen.append(snapshot.k)
                return True

            with patch("autonomous.evolve_indicators", return_value=approved), \
                 patch("autonomous.wants_entry", side_effect=entry), \
                 patch("autonomous.entry_context", return_value={"allow_buy": True,
                                                                 "reasons": [], "observation": {}}):
                result = bot.cycle()
            self.assertEqual(seen, [200])  # 800 hourly candles -> 200 four-hour candles
            self.assertEqual(result["decisions"][0]["strategy"], "trend")
            meta = bot.position_meta["BTCUSDT"]
            self.assertGreater(meta["entry_atr"], 0)
            reloaded = self.make_bot(4, path)
            self.assertEqual(reloaded.position_meta["BTCUSDT"], meta)
            with self.assertRaisesRegex(ValueError, "timeframe"):
                self.make_bot(1, path)


class ColonyIntegrationTests(unittest.TestCase):
    def test_colony_runs_new_kinds_on_real_features(self):
        from trader.colony import ColonyConfig, run_backtest
        data = {"AUSDT": random_candles(1200, seed=31), "BUSDT": random_candles(1200, seed=32)}
        report = run_backtest(data, ColonyConfig(), ignore_approval=True, hours_per_candle=4)
        self.assertEqual(report["status"], "SIMULATED")
        self.assertEqual(report["hours_per_candle"], 4)


if __name__ == "__main__":
    unittest.main()
