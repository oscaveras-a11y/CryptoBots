import math
import unittest
from unittest.mock import patch
from trader.strategy import Candle
from autonomous import AutonomousPaperBot


class FakeMarket:
    def ohlcv(self,symbol,limit):
        return [Candle(100+i*.05+2*math.sin(i/7),
                       (100+i*.05+2*math.sin(i/7))*1.01,
                       (100+i*.05+2*math.sin(i/7))*.99,100)
                for i in range(220)]


class AutonomousTests(unittest.TestCase):
    def test_rejects_unapproved_strategy(self):
        bot=AutonomousPaperBot(market=FakeMarket(),symbols=["BTCUSDT"],
                               bots=2,generations=1)
        with patch("autonomous.evolve_indicators",return_value={
            "approved_for_paper":False,
            "winner":{"fast":5,"slow":15,"rsi_buy_max":65,
                      "rsi_sell_min":30,"max_atr_percent":5,
                      "stop":.02,"take":.04}}):
            result=bot.cycle()
        self.assertEqual(result["status"],"REJECTED_HOLDOUT")
        self.assertEqual(bot.portfolio.trades,[])

    def test_approved_wait_is_idempotent(self):
        bot=AutonomousPaperBot(market=FakeMarket(),symbols=["BTCUSDT"],
                               bots=2,generations=1)
        winner={"fast":5,"slow":15,"rsi_buy_max":65,
                "rsi_sell_min":30,"max_atr_percent":5,
                "stop":.02,"take":.04}
        with patch("autonomous.evolve_indicators",return_value={
            "approved_for_paper":True,"winner":winner}):
            first=bot.cycle()
            second=bot.cycle()
        self.assertEqual(first["status"],"PAPER_ACTIVE")
        self.assertEqual(second["decisions"],[])
