import unittest
from trader.pipeline import evaluate
from trader.strategy import Candle


class PipelineTests(unittest.TestCase):
    def candles(self, values):
        return [Candle(float(p),float(p)*1.005,float(p)*.995,100.0) for p in values]

    def test_rejects_short_history(self):
        with self.assertRaises(ValueError):
            evaluate({"AUSDT":self.candles([100]*20)},bots=4,generations=1)

    def test_rejects_flat_holdout_without_trades(self):
        prices = [100.0]*150
        result = evaluate({"AUSDT":self.candles(prices)},bots=4,generations=1)
        self.assertEqual(result["status"],"REJECTED_HOLDOUT")
        self.assertIsNone(result["paper"])

    def test_rejects_unaligned_series(self):
        with self.assertRaises(ValueError):
            evaluate({"AUSDT":self.candles([100]*150),
                      "BUSDT":self.candles([100]*160)},bots=4,generations=1)
