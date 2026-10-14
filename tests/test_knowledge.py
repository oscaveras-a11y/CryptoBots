import unittest
from decimal import Decimal
from trader.knowledge import ema,rsi,atr,market_profile,risk_quantity
from trader.strategy import Candle


class KnowledgeTests(unittest.TestCase):
    def test_ema_constant(self):
        self.assertEqual(ema([100.0]*60,12),100.0)

    def test_rsi_edges(self):
        self.assertEqual(rsi([100.0]*20),50.0)
        self.assertEqual(rsi([float(x) for x in range(1,21)]),100.0)
        self.assertEqual(rsi([float(x) for x in range(21,1,-1)]),0.0)

    def test_atr_constant(self):
        candles=[Candle(100,101,99,10) for _ in range(60)]
        self.assertAlmostEqual(atr(candles),2)
        self.assertEqual(market_profile(candles)["regime"],"RANGE_OR_TRANSITION")

    def test_risk_budget(self):
        qty=risk_quantity("100","10","9")
        self.assertGreater(qty,Decimal("0"))
        self.assertLess(qty,Decimal("1"))

    def test_invalid(self):
        with self.assertRaises(ValueError):
            risk_quantity("100","10","11")
        with self.assertRaises(ValueError):
            market_profile([Candle(100,101,99,10)]*10)
