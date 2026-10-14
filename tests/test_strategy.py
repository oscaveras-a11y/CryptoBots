import unittest
from trader.strategy import Candle, trading_signal, eligible_market_order


class StrategyTests(unittest.TestCase):
    def candles(self, prices, volume=100):
        return [Candle(p,p*1.005,p*.995,volume) for p in prices]

    def test_insufficient(self):
        self.assertEqual(trading_signal(self.candles([100]*10))["reason"],"INSUFFICIENT_CANDLES")

    def test_bullish_cross(self):
        prices = [100]*40 + [110]
        result = trading_signal(self.candles(prices),fast=3,slow=10)
        self.assertEqual(result["action"],"BUY")

    def test_low_volume_prevents_buy(self):
        prices = [100]*40 + [110]
        candles = self.candles(prices)
        candles[-1] = Candle(110,111,109,1)
        result = trading_signal(candles,fast=3,slow=10)
        self.assertEqual(result["reason"],"LOW_VOLUME")

    def test_bearish_cross(self):
        prices = [110]*40 + [100]
        result = trading_signal(self.candles(prices),fast=3,slow=10)
        self.assertEqual(result["action"],"SELL")

    def test_reject_invalid_data(self):
        candles = self.candles([100]*40)
        candles[-1] = Candle(100,90,80,100)
        with self.assertRaises(ValueError):
            trading_signal(candles)

    def test_market_filters(self):
        info = {"status":"TRADING","orderTypes":["MARKET"],"filters":[
            {"filterType":"LOT_SIZE","minQty":"0.01","maxQty":"100","stepSize":"0.01"},
            {"filterType":"MIN_NOTIONAL","minNotional":"10","applyToMarket":True}
        ]}
        self.assertTrue(eligible_market_order(info,"100","0.1"))
        self.assertFalse(eligible_market_order(info,"100","0.05"))
        self.assertFalse(eligible_market_order(info,"100","0.101"))
