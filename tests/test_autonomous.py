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

    def test_rejected_retraining_preserves_exit_policy(self):
        from decimal import Decimal
        from trader.indicator_evolution import IndicatorGenome
        bot=AutonomousPaperBot(market=FakeMarket(),symbols=["BTCUSDT"],
                               bots=2,generations=1,retrain_cycles=1)
        bot.genome=IndicatorGenome(5,15,65,30,5,.02,.04)
        bot.approved=True
        bot.portfolio.holdings["BTCUSDT"]=Decimal("0.1")
        bot.portfolio.cash=Decimal("90")
        bot.entries["BTCUSDT"]=200.0
        with patch("autonomous.evolve_indicators",return_value={
            "approved_for_paper":False,
            "winner":{"fast":5,"slow":15,"rsi_buy_max":65,
                      "rsi_sell_min":30,"max_atr_percent":5,
                      "stop":.02,"take":.04}}):
            result=bot.cycle()
        self.assertEqual(result["status"],"EXIT_ONLY")
        self.assertEqual(bot.portfolio.holdings["BTCUSDT"],0)
        self.assertTrue(any(d["action"]=="SELL" for d in result["decisions"]))

    def test_open_position_without_exit_policy_fails_closed(self):
        from decimal import Decimal
        bot=AutonomousPaperBot(market=FakeMarket(),symbols=["BTCUSDT"],
                               bots=2,generations=1)
        bot.portfolio.holdings["BTCUSDT"]=Decimal("0.1")
        with patch("autonomous.evolve_indicators",return_value={
            "approved_for_paper":False,
            "winner":{"fast":5,"slow":15,"rsi_buy_max":65,
                      "rsi_sell_min":30,"max_atr_percent":5,
                      "stop":.02,"take":.04}}):
            with self.assertRaisesRegex(RuntimeError,"exit policy"):
                bot.cycle()

    def test_approved_retraining_does_not_replace_open_position_exit_rules(self):
        from decimal import Decimal
        from trader.indicator_evolution import IndicatorGenome
        bot=AutonomousPaperBot(market=FakeMarket(),symbols=["BTCUSDT"],
                               bots=2,generations=1,retrain_cycles=1)
        original=IndicatorGenome(5,15,65,30,5,.02,.04)
        bot.genome=original
        bot.approved=True
        bot.portfolio.holdings["BTCUSDT"]=Decimal("0.1")
        bot.portfolio.cash=Decimal("90")
        bot.entries["BTCUSDT"]=200.0
        changed={"fast":8,"slow":20,"rsi_buy_max":75,
                 "rsi_sell_min":25,"max_atr_percent":7,
                 "stop":.10,"take":.20}
        with patch("autonomous.evolve_indicators",return_value={
            "approved_for_paper":True,"winner":changed}):
            result=bot.cycle()
        self.assertEqual(result["status"],"PAPER_ACTIVE")
        self.assertEqual(bot.genome,original)
        self.assertTrue(any(d["action"]=="SELL" for d in result["decisions"]))
