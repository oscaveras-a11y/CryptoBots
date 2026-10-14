import unittest
from trader.evolution import Genome, simulate, evolve

class EvolutionTests(unittest.TestCase):
    def test_rejects_bad_capital(self):
        with self.assertRaises(ValueError):
            simulate([100.0]*120, Genome(5, 20, .02, .03), 0)

    def test_flat_market_costs(self):
        r = simulate([100.0]*120, Genome(5, 20, .02, .03))
        self.assertLessEqual(r["equity"], 100)

    def test_evolution_is_deterministic(self):
        data = {"TESTUSDT": [100 + i*.1 for i in range(160)]}
        a = evolve(data, 100, 8, 2, 7)
        b = evolve(data, 100, 8, 2, 7)
        self.assertEqual(a, b)
        self.assertEqual(a["mode"], "PAPER_ONLY")

if __name__ == "__main__":
    unittest.main()
