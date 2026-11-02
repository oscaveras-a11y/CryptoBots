"""Colony rules: money conservation, reproduction, death, limits, persistence."""
import json
import os
import sys
import tempfile
import unittest
from dataclasses import replace

from trader.colony import Colony, ColonyConfig, View, run_backtest, seed_genomes
from trader.indicator_evolution import IndicatorGenome

sys.path.insert(0, os.path.dirname(__file__))
from test_backtest_equivalence import random_candles  # noqa: E402

GENOME = IndicatorGenome(5, 15, 70, 20, 9, .5, .02)  # wide stop, 2% take profit
CALM = {"rsi": 50, "atr_percent": 1, "regime": "UPTREND"}
NO_COSTS = ColonyConfig(fee=0, slippage=0)
# One bot trading all of its own cash, to test reproduction arithmetic simply.
SOLO = replace(NO_COSTS, initial_bots=1, max_position_fraction=1.0, max_total_exposure=1.0)


def view(price, signal="WAIT", profile=CALM):
    return View(profile, lambda fast, slow: signal, price)


def seeded(config=NO_COSTS, symbols=("AUSDT",), genome=GENOME):
    colony = Colony(config)
    colony.seed([genome], list(symbols), t=0)
    return colony


def total_money(colony, prices):
    return colony.equity(prices)


class ColonyTests(unittest.TestCase):
    def test_seed_splits_initial_allocation_and_keeps_pool(self):
        colony = seeded(symbols=("AUSDT", "BUSDT"))
        self.assertEqual(len(colony.alive()), 4)
        self.assertEqual([a.cash for a in colony.alive()], [15.0] * 4)
        self.assertAlmostEqual(colony.pool, 40.0)
        self.assertEqual([a.symbol for a in colony.alive()], ["AUSDT", "BUSDT"] * 2)

    def test_buy_is_capped_at_ten_percent_of_colony(self):
        colony = seeded()
        colony.step(1, "d", {"AUSDT": view(100, "BUY")})
        bought = [e for e in colony.events if e["event"] == "BUY"]
        self.assertTrue(all(e["amount"] == 10.0 for e in bought))

    def test_total_exposure_limit(self):
        config = replace(NO_COSTS, initial_bots=8, max_bots=10, initial_allocation=1.0,
                         max_total_exposure=0.25)
        colony = seeded(config)
        colony.step(1, "d", {"AUSDT": view(100, "BUY")})
        buys = [e for e in colony.events if e["event"] == "BUY"]
        skips = [e for e in colony.events if e.get("reason") == "COLONY_EXPOSURE_LIMIT"]
        self.assertEqual(len(buys), 2)  # 2 x 10 = 20 <= 25; a third would be 30
        self.assertEqual(len(skips), 6)

    def test_loss_kills_bot_and_returns_money_to_pool(self):
        colony = seeded()
        colony.step(1, "d", {"AUSDT": view(100, "BUY")})
        colony.step(2, "d", {"AUSDT": view(80)})  # -20% on 10 of 15 USDT: equity 13 < 13.8
        self.assertEqual(colony.alive(), [])
        self.assertEqual(colony.deaths, {"LOSS": 4})
        self.assertAlmostEqual(colony.pool, 100 - 4 * 2.0)  # each bot lost 2 USDT
        self.assertTrue(all(a.units == 0 and a.cash == 0 for a in colony.agents))

    def test_idle_bot_dies_after_fourteen_days(self):
        colony = seeded()
        colony.step(24 * 14 - 1, "d", {"AUSDT": view(100)})
        self.assertEqual(len(colony.alive()), 4)
        colony.step(24 * 14, "d2", {"AUSDT": view(100)})
        self.assertEqual(colony.deaths, {"IDLE": 4})
        self.assertAlmostEqual(colony.pool, 100.0)

    def run_profitable_trips(self, colony, trips, start_t=1, symbol="AUSDT"):
        t, price = start_t, 100.0
        for _ in range(trips):
            colony.step(t, "d%d" % t, {symbol: view(price, "BUY")})
            colony.step(t + 1, "d%d" % t, {symbol: view(price * 1.03)})  # take profit
            t += 2
        return t

    def test_reproduction_needs_ten_trips_and_profit(self):
        config = SOLO
        colony = seeded(config)
        parent = colony.alive()[0]
        self.run_profitable_trips(colony, 9)
        self.assertEqual(len(colony.agents), 1, "9 trips are not enough, even all winning")
        self.assertGreater(parent.cash, parent.birth_capital * 1.05)
        self.run_profitable_trips(colony, 1, start_t=100)
        self.assertEqual(len(colony.agents), 2)
        child = colony.agents[1]
        self.assertEqual((child.parent, child.generation, child.symbol), ("b1", 2, "AUSDT"))
        self.assertNotEqual(child.genome, parent.genome)
        self.assertGreaterEqual(child.cash, config.min_bot_capital)
        self.assertEqual(parent.baseline, parent.cash)
        self.assertEqual(parent.trips_since_reproduction, 0)
        birth = [e for e in colony.events if e["event"] == "BIRTH" and e["bot"] == "b2"][0]
        self.assertAlmostEqual(birth["from_parent"] + birth["from_pool"], child.cash, places=3)

    def test_lucky_single_trade_never_reproduces(self):
        colony = seeded(SOLO)
        colony.step(1, "d", {"AUSDT": view(100, "BUY")})
        colony.step(2, "d", {"AUSDT": view(150)})
        self.assertEqual(len(colony.agents), 1)

    def test_reproduction_preserves_money(self):
        colony = seeded(SOLO)
        before = None
        t = 1
        for _ in range(10):
            colony.step(t, "d", {"AUSDT": view(100, "BUY")})
            colony.step(t + 1, "d", {"AUSDT": view(103)})
            if before is None:
                before = total_money(colony, {"AUSDT": 103})
            t += 2
        self.assertEqual(len(colony.agents), 2)
        realized = sum(a.cash for a in colony.agents) + colony.pool
        spent = {e["t"]: e["amount"] for e in colony.events if e["event"] == "BUY"}
        expected = 100 + sum(e["proceeds"] - spent[e["t"] - 1]
                             for e in colony.events if e["event"] == "SELL")
        self.assertAlmostEqual(realized, expected, places=3)

    def test_max_bots_is_respected(self):
        config = replace(SOLO, initial_bots=2, max_bots=2)
        colony = seeded(config)
        self.run_profitable_trips(colony, 12)
        self.assertEqual(len(colony.agents), 2)

    def test_colony_loss_limit_halts_buys_but_allows_exits(self):
        config = replace(NO_COSTS, death_loss=1.0, max_idle_hours=10 ** 6)
        colony = seeded(config)
        colony.step(1, "day1", {"AUSDT": view(100, "BUY")})
        colony.step(2, "day1", {"AUSDT": view(60)})  # colony equity 84 < 92
        self.assertEqual(colony.halted, "COLONY_TOTAL_LOSS_LIMIT")
        colony.step(3, "day1", {"AUSDT": view(60, "SELL")})
        self.assertTrue(all(a.units == 0 for a in colony.agents))
        colony.step(4, "day1", {"AUSDT": view(60, "BUY")})
        self.assertFalse([e for e in colony.events if e["event"] == "BUY" and e["t"] == 4])
        self.assertTrue([e for e in colony.events if e.get("reason") == "COLONY_TOTAL_LOSS_LIMIT"
                         and e["event"] == "SKIP"])

    def test_same_candle_is_processed_once(self):
        colony = seeded()
        self.assertTrue(colony.step(5, "d", {"AUSDT": view(100, "BUY")}))
        self.assertEqual(colony.step(5, "d", {"AUSDT": view(100, "BUY")}), [])
        self.assertEqual(colony.step(4, "d", {"AUSDT": view(100, "BUY")}), [])

    def test_state_roundtrip_continues_identically(self):
        a = seeded(SOLO)
        self.run_profitable_trips(a, 6)
        b = Colony.from_dict(json.loads(json.dumps(a.to_dict())))
        for colony in (a, b):
            self.run_profitable_trips(colony, 6, start_t=50)
        self.assertEqual(a.to_dict(), b.to_dict())
        self.assertEqual(len(a.agents), 2)

    def test_missing_market_view_fails_closed(self):
        colony = seeded()
        with self.assertRaises(ValueError):
            colony.step(1, "d", {"BUSDT": view(100)})

    def test_seed_genomes_start_from_winner(self):
        genomes = seed_genomes(GENOME, 4, seed=1)
        self.assertEqual(genomes[0], GENOME)
        self.assertEqual(len(set(genomes)), 4)
        self.assertEqual(genomes, seed_genomes(GENOME, 4, seed=1))


class ColonyBacktestTests(unittest.TestCase):
    def data(self):
        return {"AUSDT": random_candles(900, seed=1), "BUSDT": random_candles(900, seed=2)}

    def test_rejected_research_creates_no_colony(self):
        from unittest.mock import patch
        import trader.colony as module
        rejected = {"approved_for_paper": False, "winner": vars(GENOME)}
        with patch.object(module, "evolve_indicators", return_value=rejected):
            report = run_backtest(self.data())
        self.assertEqual(report["status"], "REJECTED_RESEARCH")
        self.assertNotIn("bots", report)

    def test_backtest_runs_on_unseen_part_only_and_is_deterministic(self):
        from unittest.mock import patch
        import trader.colony as module
        calls = []
        real = module.evolve_indicators

        def spy(data, **kw):
            calls.append({s: len(c) for s, c in data.items()})
            return real(data, **kw)

        with patch.object(module, "evolve_indicators", side_effect=spy):
            first = run_backtest(self.data(), ignore_approval=True)
        self.assertEqual(calls, [{"AUSDT": 630, "BUSDT": 630}])
        self.assertEqual(first["colony_candles"], 270)
        self.assertEqual(first["status"], "SIMULATED")
        self.assertIn("buy_hold_equity", first)
        self.assertEqual(first, run_backtest(self.data(), ignore_approval=True))


class LiveColonyTests(unittest.TestCase):
    def test_live_cycle_persists_and_does_not_repeat_candle(self):
        from unittest.mock import patch
        import colony as cli

        class Market:
            def ohlcv(self, symbol, limit):
                return random_candles(400, seed=3 if symbol == "AUSDT" else 4)

            def price(self, symbol):
                return 100.0

        approved = {"approved_for_paper": True, "winner": vars(GENOME)}
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(cli, "evolve_indicators", return_value=approved) as research:
            path = os.path.join(folder, "colony.json")
            live = cli.LiveColony(Market(), ["AUSDT", "BUSDT"], ColonyConfig(), path)
            summary = live.cycle()
            self.assertEqual(summary["alive"], 4)
            again = cli.LiveColony(Market(), ["AUSDT", "BUSDT"], ColonyConfig(), path)
            self.assertEqual(again.cycle()["new_events"], [])  # same candle: nothing new
            self.assertEqual(research.call_count, 1)
            with self.assertRaises(ValueError):
                cli.LiveColony(Market(), ["AUSDT"], ColonyConfig(), path)


if __name__ == "__main__":
    unittest.main()
