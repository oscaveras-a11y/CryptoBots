import io
import sys
import unittest
from unittest.mock import patch
from trader.execution import BinanceSpotTestnet
import testnet


class TestnetOrderTests(unittest.TestCase):
    def test_execution_is_testnet_endpoint_only(self):
        api=BinanceSpotTestnet(key="fake",secret="fake")
        with patch.object(api,"request",return_value={"orderId":123,"status":"FILLED"}) as req:
            result=api.place_testnet_order("BTCUSDT","BUY","0.001")
        self.assertEqual(result["orderId"],123)
        self.assertEqual(req.call_args.args[0],"order")
        self.assertEqual(req.call_args.kwargs["method"],"POST")

    def test_confirmation_required(self):
        with patch.object(sys,"argv",["testnet.py","--execute"]):
            with self.assertRaises(SystemExit):
                testnet.main()

    def test_status_query(self):
        api=BinanceSpotTestnet(key="fake",secret="fake")
        with patch.object(api,"request",return_value={"status":"FILLED"}) as req:
            self.assertEqual(api.order_status("BTCUSDT",123)["status"],"FILLED")
        self.assertEqual(req.call_args.kwargs["signed"],True)

    def test_reject_invalid_order(self):
        api=BinanceSpotTestnet(key="fake",secret="fake")
        with self.assertRaises(ValueError):
            api.place_testnet_order("BTCUSDT","BUY","0")
