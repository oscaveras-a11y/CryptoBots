import io
import json
import sys
import unittest
from unittest.mock import patch
from trader.strategy import Candle
import main


class MainEngineTests(unittest.TestCase):
    def test_indicator_engine_is_default(self):
        candles=[Candle(100,101,99,100)]*200
        report={"mode":"PAPER_ONLY","approved_for_paper":False}
        with patch.object(sys,"argv",["main.py","--symbols","1","--bots","2","--generations","1",
                                      "--strategy","legacy","--timeframe","1"]), \
             patch.object(main.Market,"select_symbols",return_value=["BTCUSDT"]), \
             patch.object(main.Market,"ohlcv",return_value=candles) as get_candles, \
             patch.object(main,"evolve_indicators",return_value=report) as research, \
             patch("sys.stdout",new_callable=io.StringIO) as output:
            main.main()
        get_candles.assert_called_once()
        research.assert_called_once()
        self.assertEqual(json.loads(output.getvalue())["engine"],"indicators")


class MainDefaultsTests(unittest.TestCase):
    def test_default_is_robust_trend_preset_on_six_hours(self):
        import random
        from trader.indicator_evolution import ROBUST_TREND
        rng=random.Random(1); price=100.0; candles=[]
        for i in range(180*24):
            o=price; price=max(1.0,price*(1+rng.gauss(0,.006)))
            candles.append(Candle(price,max(o,price)*1.002,min(o,price)*.998,100.0,
                                  open=o,open_time=i*3_600_000))
        with patch.object(sys,"argv",["main.py","--symbols","1"]), \
             patch.object(main.Market,"select_symbols",return_value=["BTCUSDT"]), \
             patch.object(main.Market,"ohlcv",return_value=candles), \
             patch("sys.stdout",new_callable=io.StringIO) as output:
            main.main()
        report=json.loads(output.getvalue())
        self.assertEqual((report["strategy"],report["timeframe_hours"]),("preset",6))
        self.assertEqual(report["winner"]["kind"],ROBUST_TREND.kind)
        self.assertEqual(report["approval"],"sanity")
        self.assertEqual(report["history_candles"],{"BTCUSDT":720})

