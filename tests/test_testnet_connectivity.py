"""Offline tests for read-only Spot Testnet connectivity."""
import unittest
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
