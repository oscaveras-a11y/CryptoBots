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


H = 3_600_000


def kline(t, price=100.0):
    # [open_time, open, high, low, close, volume, close_time, ...]
    return [t, str(price), str(price + 1), str(price - 1), str(price + .5), "10", t + H - 1]


class FakeKlines(Market):
    """Serves an hourly series like Binance: newest `limit` rows before endTime."""
    def __init__(self, count, start=1_700_000_000_000 // H * H, gap_at=None):
        super().__init__(sleep=lambda s: None)
        self.series = [kline(start + i * H, 100 + i * .01) for i in range(count)]
        if gap_at is not None:
            del self.series[gap_at]
        self.calls = []

    def get(self, path, params=None):
        self.calls.append(dict(params))
        rows = self.series
        if "endTime" in params:
            rows = [r for r in rows if r[0] <= params["endTime"]]
        return rows[-params["limit"]:]


class PaginationTests(unittest.TestCase):
    def test_paginates_beyond_1000_and_drops_open_candle(self):
        m = FakeKlines(2500)
        now = m.series[-1][0] + 10  # last candle still open
        candles = m.ohlcv("BTCUSDT", 2160, now_ms=now)
        self.assertEqual(len(candles), 2160)
        self.assertEqual(candles[-1].open_time, m.series[-2][0])
        times = [c.open_time for c in candles]
        self.assertEqual(times, sorted(set(times)))
        self.assertTrue(all(c["limit"] <= 1000 for c in m.calls))
        self.assertGreaterEqual(len(m.calls), 3)
        self.assertEqual(candles[0].open, 100 + (2500 - 2 - 2159) * .01)

    def test_short_history_pair_is_accepted_if_enough(self):
        m = FakeKlines(400)
        candles = m.ohlcv("NEWUSDT", 2160, now_ms=m.series[-1][0] + H)
        self.assertEqual(len(candles), 400)

    def test_gap_in_sequence_fails_closed(self):
        m = FakeKlines(600, gap_at=300)
        with self.assertRaisesRegex(RuntimeError, "sequencia"):
            m.ohlcv("BTCUSDT", 500, now_ms=m.series[-1][0] + H)

    def test_align_by_time_keeps_common_hours(self):
        from trader.market import align_by_time
        from trader.strategy import Candle
        a = [Candle(1, 1, 1, 1, open=1, open_time=t) for t in (1, 2, 3, 4)]
        b = [Candle(1, 1, 1, 1, open=1, open_time=t) for t in (2, 3, 4, 5)]
        out = align_by_time({"A": a, "B": b})
        self.assertEqual([c.open_time for c in out["A"]], [2, 3, 4])
        self.assertEqual([c.open_time for c in out["B"]], [2, 3, 4])


if __name__ == "__main__":
    unittest.main()
