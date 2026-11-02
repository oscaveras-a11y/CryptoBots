"""Offline tests: Binance error decoding, clock sync and quantity formatting."""
import json
import unittest
from io import BytesIO
from urllib.error import HTTPError
from unittest.mock import patch

from trader.execution import BinanceSpotTestnet, BinanceAPIError, format_quantity


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.payload


def http_error(status, body):
    return HTTPError("https://testnet.binance.vision/api/v3/x?signature=LEAK",
                     status, "err", {}, BytesIO(json.dumps(body).encode()))


class TestnetClientTests(unittest.TestCase):
    def test_quantity_never_scientific(self):
        self.assertEqual(format_quantity("0.0000001"), "0.0000001")
        self.assertEqual(format_quantity(1e-7), "0.0000001")
        self.assertEqual(format_quantity("0.00100"), "0.001")
        self.assertEqual(format_quantity("10"), "10")
        with self.assertRaises(ValueError):
            format_quantity("0")

    def test_binance_error_code_is_reported_without_secrets(self):
        api = BinanceSpotTestnet(key="MYKEY123", secret="MYSECRET456")
        api.time_offset_ms = 0
        error = http_error(401, {"code": -2015, "msg": "Invalid API-key MYKEY123, IP, or permissions."})
        with patch("trader.execution.urlopen", side_effect=error):
            with self.assertRaises(BinanceAPIError) as captured:
                api.account()
        text = str(captured.exception)
        self.assertEqual(captured.exception.code, -2015)
        self.assertIn("-2015", text)
        self.assertIn("TESTNET", text)
        for leak in ("MYKEY123", "MYSECRET456", "LEAK", "signature"):
            self.assertNotIn(leak, text)

    def test_clock_offset_applied_to_timestamp(self):
        api = BinanceSpotTestnet(key="k", secret="s")
        calls = []

        def fake_open(req, timeout):
            calls.append(req.full_url)
            if "/time" in req.full_url:
                return FakeResponse({"serverTime": 2_000_000})
            return FakeResponse({"balances": []})

        with patch("trader.execution.time.time", return_value=1_000.0), \
             patch("trader.execution.urlopen", side_effect=fake_open):
            api.account()
        self.assertEqual(api.time_offset_ms, 1_000_000)
        self.assertIn("timestamp=2000000", calls[-1])

    def test_timestamp_error_resyncs_once_and_retries(self):
        api = BinanceSpotTestnet(key="k", secret="s")
        api.time_offset_ms = 0
        state = {"account_calls": 0}

        def fake_open(req, timeout):
            if "/time" in req.full_url:
                return FakeResponse({"serverTime": 5})
            state["account_calls"] += 1
            if state["account_calls"] == 1:
                raise http_error(400, {"code": -1021, "msg": "Timestamp outside recvWindow."})
            return FakeResponse({"balances": [], "canTrade": True})

        with patch("trader.execution.urlopen", side_effect=fake_open):
            self.assertTrue(api.account()["canTrade"])
        self.assertEqual(state["account_calls"], 2)

    def test_timestamp_error_not_retried_forever(self):
        api = BinanceSpotTestnet(key="k", secret="s")
        api.time_offset_ms = 0

        def fake_open(req, timeout):
            if "/time" in req.full_url:
                return FakeResponse({"serverTime": 5})
            raise http_error(400, {"code": -1021, "msg": "Timestamp outside recvWindow."})

        with patch("trader.execution.urlopen", side_effect=fake_open):
            with self.assertRaises(BinanceAPIError) as captured:
                api.account()
        self.assertIn("relogio", str(captured.exception))

    def test_region_block_is_explained(self):
        api = BinanceSpotTestnet(key="k", secret="s")
        api.time_offset_ms = 0
        error = HTTPError("u", 451, "x", {}, BytesIO(b"not json"))
        with patch("trader.execution.urlopen", side_effect=error):
            with self.assertRaisesRegex(BinanceAPIError, "regiao bloqueada"):
                api.account()

    def test_public_time_request_sends_no_api_key(self):
        api = BinanceSpotTestnet(key="k", secret="s")
        with patch("trader.execution.urlopen", return_value=FakeResponse({"serverTime": 1})) as opener:
            api.sync_time()
        req = opener.call_args.args[0]
        self.assertIsNone(req.get_header("X-mbx-apikey"))
        self.assertNotIn("signature", req.full_url)

    def test_whitespace_in_credentials_is_stripped(self):
        api = BinanceSpotTestnet(key="  key\n", secret="secret \n")
        self.assertEqual((api.key, api.secret), ("key", "secret"))


if __name__ == "__main__":
    unittest.main()
