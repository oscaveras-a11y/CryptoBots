"""Offline tests for read-only Spot Testnet connectivity."""
import unittest
from io import BytesIO
from urllib.error import HTTPError
from unittest.mock import patch
import testnet_connect


class ConnectivityTests(unittest.TestCase):
    def test_summary_does_not_expose_balances_or_secrets(self):
        summary = testnet_connect.safe_account_summary({
            "canTrade": True,
            "balances": [{"asset": "BTC", "free": "1.0", "locked": "0"},
                         {"asset": "USDT", "free": "0", "locked": "0"}],
        })
        self.assertEqual(summary["nonzero_asset_count"], 1)
        self.assertEqual(summary["orders_sent"], 0)
        self.assertNotIn("balances", summary)

    def test_signed_request_http_error_does_not_leak_credentials(self):
        from trader.execution import BinanceSpotTestnet
        api=BinanceSpotTestnet(key="SECRET_API_KEY",secret="SECRET_API_SECRET")
        error=HTTPError("https://testnet.binance.vision/api/v3/account?signature=LEAK",
                        401,"Unauthorized",{},BytesIO(b"SECRET_BODY"))
        with patch("trader.execution.urlopen",side_effect=error):
            with self.assertRaises(RuntimeError) as captured:
                api.account()
        message=str(captured.exception)
        self.assertIn("401",message)
        for secret in ("SECRET_API_KEY","SECRET_API_SECRET","LEAK","SECRET_BODY"):
            self.assertNotIn(secret,message)

    def test_request_rejects_unexpected_api_paths(self):
        from trader.execution import BinanceSpotTestnet
        api=BinanceSpotTestnet(key="key",secret="secret")
        with self.assertRaises(ValueError):
            api.request("api/v3/withdraw",signed=True)

    def test_ping_uses_testnet_only(self):
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self): return b"{}"
        with patch("testnet_connect.urlopen", return_value=FakeResponse()) as request:
            self.assertEqual(testnet_connect.public_ping(), {})
        self.assertEqual(request.call_args.args[0],
                         "https://testnet.binance.vision/api/v3/ping")


if __name__ == "__main__":
    unittest.main()
