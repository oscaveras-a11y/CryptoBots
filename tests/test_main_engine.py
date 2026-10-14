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
        with patch.object(sys,"argv",["main.py","--symbols","1","--bots","2","--generations","1"]), \
             patch.object(main.Market,"select_symbols",return_value=["BTCUSDT"]), \
             patch.object(main.Market,"ohlcv",return_value=candles) as get_candles, \
             patch.object(main,"evolve_indicators",return_value=report) as research, \
             patch("sys.stdout",new_callable=io.StringIO) as output:
            main.main()
        get_candles.assert_called_once()
        research.assert_called_once()
        self.assertEqual(json.loads(output.getvalue())["engine"],"indicators")
