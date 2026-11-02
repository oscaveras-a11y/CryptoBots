"""Offline tests for public market data retry and mirror fallback."""
import unittest
from urllib.error import HTTPError, URLError

from trader.market import Market, BASE, MIRROR


def err(status, retry_after=None):
    headers = {"Retry-After": retry_after} if retry_after else {}
    return HTTPError("u", status, "x", headers, None)


class ScriptedMarket(Market):
    def __init__(self, script, **kw):
        self.waits = []
        super().__init__(sleep=self.waits.append, **kw)
        self.script = list(script)
        self.urls = []

    def _fetch(self, url):
        self.urls.append(url)
        outcome = self.script.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class MarketTests(unittest.TestCase):
    def test_retries_rate_limit_then_succeeds(self):
        m = ScriptedMarket([err(429, "3"), {"ok": 1}])
        self.assertEqual(m.get("ping"), {"ok": 1})
        self.assertEqual(m.waits, [3.0])

    def test_region_block_falls_back_to_mirror_and_remembers(self):
        m = ScriptedMarket([err(451), {"ok": 1}, {"ok": 2}])
        self.assertEqual(m.get("klines", {"symbol": "BTCUSDT"}), {"ok": 1})
        self.assertTrue(m.urls[0].startswith(BASE))
        self.assertTrue(m.urls[1].startswith(MIRROR))
        m.get("ping")
        self.assertTrue(m.urls[2].startswith(MIRROR))

    def test_network_errors_use_backoff_then_fail_clearly(self):
        m = ScriptedMarket([URLError("x")] * 6)
        with self.assertRaisesRegex(RuntimeError, "indisponiveis"):
            m.get("ping")
        self.assertEqual(len(m.urls), 6)

    def test_client_error_is_not_retried(self):
        m = ScriptedMarket([err(400)])
        with self.assertRaisesRegex(RuntimeError, "HTTP 400"):
            m.get("klines")
        self.assertEqual(len(m.urls), 1)


if __name__ == "__main__":
    unittest.main()
