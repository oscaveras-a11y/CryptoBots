import unittest
from trader.strategy import Candle
from trader.decision_context import entry_context


def candles(prices, volumes=None):
    volumes=volumes or [100]*len(prices)
    return [Candle(p,p*1.01,p*.99,v) for p,v in zip(prices,volumes)]


class DecisionContextTests(unittest.TestCase):
    def test_crash_blocks_buy(self):
        data=candles([100]*25+[85])
        result=entry_context("ETHUSDT",data,btc_change=-6)
        self.assertFalse(result["allow_buy"])
        self.assertIn("SHARP_24H_DECLINE",result["reasons"])
        self.assertIn("BITCOIN_MARKET_STRESS",result["reasons"])

    def test_normal_market_allows_buy(self):
        data=candles([100]*26)
        self.assertTrue(entry_context("ETHUSDT",data,btc_change=0)["allow_buy"])

    def test_volume_spike_blocks_buy(self):
        data=candles([100]*26,[100]*25+[500])
        self.assertIn("EXTREME_VOLUME_SPIKE",
                      entry_context("BTCUSDT",data)["reasons"])
