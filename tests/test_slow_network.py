"""Slow connections: longer waits, safe read retries, no needless account calls."""
import unittest
from decimal import Decimal
from unittest.mock import Mock, patch

from autonomous import AutonomousPaperBot
from trader.broker import TestnetBroker
from trader.execution import BinanceAPIError, BinanceSpotTestnet, Limits, PaperPortfolio


class FakeResponse:
    def __init__(self, body=b'{"ok": true}'):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body


def api(**kw):
    waits = []
    client = BinanceSpotTestnet(key="k", secret="s", sleep=waits.append, **kw)
    client.time_offset_ms = 0
    return client, waits


class RetryTests(unittest.TestCase):
    def test_reads_are_retried_with_fresh_signature_then_succeed(self):
        client, waits = api()
        urls = []

        def opener(req, timeout):
            urls.append(req.full_url)
            self.assertEqual(timeout, 60)
            if len(urls) < 3:
                raise TimeoutError("slow")
            return FakeResponse(b'{"balances": []}')

        with patch("trader.execution.urlopen", side_effect=opener), \
             patch("trader.execution.time.time", side_effect=[1.0, 2.0, 3.0]):
            self.assertEqual(client.account(), {"balances": []})
        self.assertEqual(waits, [2, 4])
        self.assertEqual(len(urls), 3)
        self.assertEqual(len({u.split("timestamp=")[1].split("&")[0] for u in urls}), 3)

    def test_reads_give_up_after_two_retries(self):
        client, waits = api()
        with patch("trader.execution.urlopen", side_effect=TimeoutError("slow")) as opener:
            with self.assertRaisesRegex(RuntimeError, "inacessivel ou lenta"):
                client.account()
        self.assertEqual(opener.call_count, 3)

    def test_orders_are_never_resent(self):
        client, waits = api()
        with patch("trader.execution.urlopen", side_effect=TimeoutError("slow")) as opener:
            with self.assertRaises(RuntimeError):
                client.place_testnet_order("BTCUSDT", "BUY", "0.001", client_id="cb-B-BTCUSDT-1")
        self.assertEqual(opener.call_count, 1)
        self.assertEqual(waits, [])

    def test_exchange_rejections_are_not_retried(self):
        from io import BytesIO
        from urllib.error import HTTPError
        client, waits = api()
        error = HTTPError("u", 401, "x", {}, BytesIO(b'{"code": -2015, "msg": "bad key"}'))
        with patch("trader.execution.urlopen", side_effect=error) as opener:
            with self.assertRaises(BinanceAPIError):
                client.account()
        self.assertEqual(opener.call_count, 1)


class ReconcileTests(unittest.TestCase):
    def test_no_position_means_no_account_request(self):
        fake = Mock()
        broker = TestnetBroker(PaperPortfolio(Limits(capital=Decimal("100"))), fake)
        self.assertEqual(broker.reconcile(), {})
        fake.account.assert_not_called()

    def test_open_position_is_still_checked(self):
        fake = Mock()
        fake.account.return_value = {"balances": [{"asset": "BTC", "free": "0", "locked": "0"}]}
        portfolio = PaperPortfolio(Limits(capital=Decimal("100")))
        portfolio.holdings["BTCUSDT"] = Decimal("0.001")
        with self.assertRaisesRegex(RuntimeError, "DIVERGENTE"):
            TestnetBroker(portfolio, fake).reconcile()


class RiskIntervalTests(unittest.TestCase):
    def test_default_is_five_minutes_and_minimum_is_one(self):
        self.assertEqual(AutonomousPaperBot(market=Mock(), hybrid=True).risk_interval, 300)
        with self.assertRaises(ValueError):
            AutonomousPaperBot(market=Mock(), hybrid=True, risk_interval=30)

    def test_hybrid_loop_sleeps_risk_interval_between_checks(self):
        bot = AutonomousPaperBot(market=Mock(), hybrid=True, risk_interval=300)
        sleeps = []

        class Stop(Exception):
            pass

        def fake_sleep(seconds):
            sleeps.append(seconds)
            if len(sleeps) == 2:
                raise Stop()

        with patch.object(bot, "cycle", return_value={}), \
             patch.object(bot, "risk_cycle", return_value={"risk_exits": []}) as risk, \
             patch("autonomous.time.sleep", side_effect=fake_sleep):
            with self.assertRaises(Stop):
                bot.run(interval=3600)
        self.assertEqual(sleeps, [300, 300])
        risk.assert_called_once()

    def test_cli_passes_risk_interval(self):
        import sys
        import autonomous
        captured = {}

        class Stop(Exception):
            pass

        def fake(**kw):
            captured.update(kw)
            raise Stop()

        with patch.object(sys, "argv", ["autonomous.py", "--hybrid", "--risk-interval", "600"]), \
             patch.object(autonomous, "AutonomousPaperBot", side_effect=fake):
            with self.assertRaises(Stop):
                autonomous.main()
        self.assertEqual((captured["hybrid"], captured["risk_interval"]), (True, 600))


if __name__ == "__main__":
    unittest.main()
