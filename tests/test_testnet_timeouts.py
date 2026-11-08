"""Slow or dropped connections: clear errors, and executed orders are never hidden."""
import io
import json
import sys
import unittest
from http.client import RemoteDisconnected
from unittest.mock import patch

import testnet
from trader.execution import BinanceAPIError, BinanceSpotTestnet
from trader.market import Market


class TimeoutTests(unittest.TestCase):
    def test_read_timeout_becomes_clear_runtime_error(self):
        api = BinanceSpotTestnet(key="k", secret="s", sleep=lambda seconds: None)
        api.time_offset_ms = 0
        for failure in (TimeoutError("The read operation timed out"),
                        RemoteDisconnected("closed"), ConnectionResetError()):
            with patch("trader.execution.urlopen", side_effect=failure):
                with self.assertRaisesRegex(RuntimeError, "inacessivel ou lenta"):
                    api.account()

    def test_market_data_retries_after_read_timeout(self):
        class Flaky(Market):
            calls = 0

            def _fetch(self, url):
                Flaky.calls += 1
                if Flaky.calls == 1:
                    raise TimeoutError("slow")
                return {"ok": True}

        self.assertEqual(Flaky(sleep=lambda s: None).get("ping"), {"ok": True})

    def run_cli(self, api, *args):
        out, err = io.StringIO(), io.StringIO()
        with patch.object(testnet, "BinanceSpotTestnet", return_value=api), \
             patch.object(sys, "argv", ["testnet.py", *args]), \
             patch("sys.stdout", out), patch("sys.stderr", err):
            try:
                testnet.main()
            except SystemExit:
                pass
        return out.getvalue(), err.getvalue()

    def test_order_is_printed_even_if_confirmation_fails(self):
        class Api:
            def place_testnet_order(self, *a, **k):
                return {"orderId": 7, "status": "FILLED", "side": "SELL"}

            def order_status(self, *a):
                raise RuntimeError("Binance Spot Testnet inacessivel ou lenta")

        out, err = self.run_cli(Api(), "--execute", "--confirm-testnet", "--side", "SELL")
        self.assertEqual(json.loads(out)["order"]["orderId"], 7)
        self.assertIn("confirmacao falhou", err)

    def test_timeout_on_send_looks_order_up_instead_of_resending(self):
        class Api:
            sent = 0

            def place_testnet_order(self, symbol, side, quantity, client_id=None):
                Api.sent += 1
                self.client_id = client_id
                raise RuntimeError("Binance Spot Testnet inacessivel ou lenta")

            def order_by_client_id(self, symbol, client_id):
                assert client_id == self.client_id
                return {"orderId": 9, "status": "FILLED"}

            def order_status(self, *a):
                return {"status": "FILLED", "executedQty": "0.001"}

        out, err = self.run_cli(Api(), "--execute", "--confirm-testnet")
        self.assertEqual(Api.sent, 1)
        self.assertIn('"orderId": 9', out)
        self.assertIn("Conferindo", err)

    def test_rejected_order_is_not_looked_up(self):
        class Api:
            def place_testnet_order(self, *a, **k):
                raise BinanceAPIError(400, -2010, "insufficient balance")

            def order_by_client_id(self, *a):
                raise AssertionError("must not look up a rejected order")

        out, err = self.run_cli(Api(), "--execute", "--confirm-testnet")
        self.assertIn("-2010", err)
        self.assertEqual(out, "")

    def test_account_filter_by_asset(self):
        class Api:
            def account(self):
                return {"balances": [{"asset": a, "free": "1", "locked": "0"}
                                     for a in ("BTC", "ETH", "USDT", "XRP")]}

        out, _ = self.run_cli(Api(), "--account", "--asset", "btc", "USDT")
        self.assertEqual([b["asset"] for b in json.loads(out)["balances"]], ["BTC", "USDT"])


if __name__ == "__main__":
    unittest.main()
