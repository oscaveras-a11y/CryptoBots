"""Deterministic evolutionary diagnostics on synthetic regimes.

No exchange data, no real trading, no profitability guarantee.
"""
import math
import unittest
from trader.evolution import evolve


def synthetic_market(n=360):
    # Multiple regimes, deterministic oscillation and trends; no look-ahead.
    return [100 + 0.065*i + 3*math.sin(i/8) + 1.2*math.sin(i/2.7)
            + (0.16*(i-240) if i >= 240 else 0)
            for i in range(n)]


class EvolutionDiagnostics(unittest.TestCase):
    def test_eight_generations_and_holdout(self):
        prices = synthetic_market()
        report = evolve({"SYNTHUSDT": prices}, 100, bots=20, generations=8, seed=42)
        self.assertEqual(len(report["generations"]), 8)
        self.assertTrue(all(math.isfinite(g["best_train_score"])
                            for g in report["generations"]))
        self.assertTrue(all(g["generation"] == i+1
                            for i,g in enumerate(report["generations"])))
        self.assertIn("SYNTHUSDT",report["out_of_sample"])
        self.assertGreater(report["out_of_sample"]["SYNTHUSDT"]["equity"],0)
        self.assertEqual(report["mode"],"PAPER_ONLY")

    def test_repeatable_research(self):
        data = {"SYNTHUSDT": synthetic_market()}
        self.assertEqual(evolve(data,100,bots=20,generations=8,seed=42),
                         evolve(data,100,bots=20,generations=8,seed=42))
