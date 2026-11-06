"""Regression tests for opt-in hybrid entry gate and minute risk monitoring."""
import unittest
from unittest.mock import Mock, patch
from decimal import Decimal
from autonomous import AutonomousPaperBot
from trader.indicator_evolution import IndicatorGenome


class HybridTests(unittest.TestCase):
    def test_hybrid_gate_rejects_weak_intraday_trend(self):
        market=Mock()
        market.get.return_value=[
            [0,0,0,0,str(v),0,1] for v in (100,101,102,101,99)]
        bot=AutonomousPaperBot(market=market,hybrid=True)
        snapshot=Mock()
        snapshot.atr.return_value=2
        with patch("autonomous.time.time",return_value=100):
            allowed,reason=bot.hybrid_entry_allowed("BTCUSDT",100,snapshot)
        self.assertFalse(allowed)
        self.assertEqual(reason,"15M_TREND_NOT_CONFIRMED")

    def test_cost_gate_rejects_low_range(self):
        market=Mock()
        market.get.return_value=[
            [0,0,0,0,str(v),0,1] for v in (100,101,102,103,104)]
        bot=AutonomousPaperBot(market=market,hybrid=True)
        snapshot=Mock()
        snapshot.atr.return_value=0.1
        with patch("autonomous.time.time",return_value=100):
            allowed,reason=bot.hybrid_entry_allowed("BTCUSDT",100,snapshot)
        self.assertFalse(allowed)
        self.assertEqual(reason,"RANGE_BELOW_COSTS")

    def test_minute_stop_exits_without_waiting_for_candle(self):
        market=Mock()
        market.price.return_value=90.0
        bot=AutonomousPaperBot(market=market,hybrid=True)
        bot.portfolio.holdings["BTCUSDT"]=Decimal("0.01")
        bot.portfolio.cash=Decimal("50")
        bot.genome=IndicatorGenome(fast=10,slow=30,rsi_buy_max=50,rsi_sell_min=30,max_atr_percent=5,kind="ma_cross",stop=0.05,take=0.1)
        bot.position_meta["BTCUSDT"]={"entry":100,"highest":100,"entry_atr":1,"held":0}
        bot.broker.sell=Mock()
        bot.after_fill=Mock()
        result=bot.risk_cycle()
        self.assertEqual(result["risk_exits"][0]["reason"],"MINUTE_STOP")
        bot.broker.sell.assert_called_once()

    def test_hybrid_disabled_avoids_intraday_request(self):
        market=Mock()
        bot=AutonomousPaperBot(market=market,hybrid=False)
        self.assertEqual(bot.hybrid_entry_allowed("BTCUSDT",100,Mock()),(True,"DISABLED"))
        market.get.assert_not_called()


if __name__=="__main__":
    unittest.main()
