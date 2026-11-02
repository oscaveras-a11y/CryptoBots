"""Testnet execution: filters, confirmed fills only, no duplicate orders, recovery."""
import json
import os
import sys
import tempfile
import unittest
from decimal import Decimal
from unittest.mock import patch

from autonomous import AutonomousPaperBot
from trader.broker import TestnetBroker, client_order_id, floor_to
from trader.execution import BinanceAPIError, Limits, PaperPortfolio
from trader.indicator_evolution import IndicatorGenome
from trader.strategy import Candle

H = 3_600_000
WINNER = {"fast": 5, "slow": 15, "rsi_buy_max": 70, "rsi_sell_min": 20,
          "max_atr_percent": 9, "stop": .5, "take": .9}
BTC_INFO = {"symbol": "BTCUSDT", "status": "TRADING", "orderTypes": ["LIMIT", "MARKET"],
            "quoteOrderQtyMarketAllowed": True,
            "filters": [{"filterType": "LOT_SIZE", "minQty": "0.00001", "maxQty": "9000",
                         "stepSize": "0.00001"},
                        {"filterType": "NOTIONAL", "minNotional": "5", "applyMinToMarket": True,
                         "maxNotional": "9000000", "applyMaxToMarket": False}]}


class FakeTestnet:
    """In-memory Binance Spot Testnet with scripted failures."""
    def __init__(self, price=50000.0, usdt="10000", btc="1"):
        self.price = price
        self.balances = {"USDT": Decimal(usdt), "BTC": Decimal(btc)}
        self.orders = {}
        self.placed = []
        self.fail_next_send = None   # "timeout_lost" | "timeout_done" | "reject" | "5xx"
        self.lookup_fails = False

    def symbol_info(self, symbol):
        return BTC_INFO

    def ticker_price(self, symbol):
        return self.price

    def account(self):
        return {"canTrade": True, "balances": [{"asset": a, "free": str(v), "locked": "0"}
                                               for a, v in self.balances.items()]}

    def _execute(self, symbol, side, client_id, quantity=None, quote_quantity=None):
        price = Decimal(str(self.price))
        if side == "BUY":
            quote = Decimal(str(quote_quantity))
            qty = floor_to(quote / price, Decimal("0.00001"))
            quote = qty * price
            fee = qty * Decimal("0.001")
            self.balances["USDT"] -= quote
            self.balances["BTC"] += qty - fee
            fills = [{"price": str(price), "qty": str(qty), "commission": str(fee),
                      "commissionAsset": "BTC"}]
        else:
            qty = Decimal(str(quantity))
            quote = qty * price
            fee = quote * Decimal("0.001")
            self.balances["BTC"] -= qty
            self.balances["USDT"] += quote - fee
            fills = [{"price": str(price), "qty": str(qty), "commission": str(fee),
                      "commissionAsset": "USDT"}]
        order = {"symbol": symbol, "orderId": len(self.orders) + 1, "clientOrderId": client_id,
                 "status": "FILLED", "executedQty": str(qty), "cummulativeQuoteQty": str(quote),
                 "fills": fills}
        self.orders[client_id] = order
        return order

    def place_testnet_order(self, symbol, side, quantity=None, client_id=None, quote_quantity=None):
        self.placed.append((side, client_id, quantity, quote_quantity))
        mode, self.fail_next_send = self.fail_next_send, None
        if mode == "reject":
            raise BinanceAPIError(400, -2010, "Account has insufficient balance.")
        if mode == "timeout_lost":
            raise RuntimeError("Binance Spot Testnet inacessivel")
        order = self._execute(symbol, side, client_id, quantity, quote_quantity)
        if mode == "timeout_done":
            raise RuntimeError("Binance Spot Testnet inacessivel")
        if mode == "5xx":
            raise BinanceAPIError(503, None, None)
        return order

    def order_by_client_id(self, symbol, client_id):
        if self.lookup_fails:
            raise RuntimeError("Binance Spot Testnet inacessivel")
        if client_id not in self.orders:
            raise BinanceAPIError(400, -2013, "Order does not exist.")
        order = dict(self.orders[client_id])
        order.pop("fills")  # lookups carry no commission detail
        return order


class FakeMarket:
    def __init__(self, price=50000.0):
        self.live = price
        self.start = 1_700_000_000_000 // H * H

    def ohlcv(self, symbol, limit):
        return [Candle(50000.0, 50100.0, 49900.0, 100.0, open=50000.0,
                       open_time=self.start + i * H) for i in range(220)]

    def price(self, symbol):
        return self.live


def new_broker(api=None, cash="100"):
    portfolio = PaperPortfolio(Limits(capital=Decimal(cash)))
    return TestnetBroker(portfolio, api or FakeTestnet()), portfolio


def no_pending_store():
    seen = []
    return seen, seen.append


class BrokerTests(unittest.TestCase):
    def test_buy_books_confirmed_fill_net_of_commission(self):
        broker, portfolio = new_broker()
        seen, store = no_pending_store()
        trade = broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "cb-B-BTCUSDT-1", store)
        self.assertEqual(broker.api.placed[0][3], Decimal("10.00"))  # 10% of 100 USDT
        self.assertEqual(portfolio.holdings["BTCUSDT"], Decimal("0.00019980"))
        self.assertEqual(portfolio.cash, Decimal("90"))  # 0.0002 BTC * 50000 = 10 spent
        self.assertEqual(trade["mode"], "TESTNET")
        self.assertFalse(trade["fee_estimated"])
        self.assertEqual(seen[0]["client_id"], "cb-B-BTCUSDT-1")
        self.assertIsNone(seen[-1])  # pending cleared after booking

    def test_order_below_minimum_is_not_sent(self):
        broker, portfolio = new_broker(cash="30")  # 10% = 3 USDT < 5 USDT minimum
        with self.assertRaisesRegex(ValueError, "FILTERS"):
            broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "x", lambda p: None)
        self.assertEqual(broker.api.placed, [])

    def test_testnet_price_far_from_market_blocks_buy(self):
        broker, _ = new_broker(FakeTestnet(price=53000.0))
        with self.assertRaisesRegex(ValueError, "DEVIATION"):
            broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "x", lambda p: None)
        self.assertEqual(broker.api.placed, [])

    def test_timeout_after_execution_is_looked_up_not_resent(self):
        api = FakeTestnet()
        api.fail_next_send = "timeout_done"
        broker, portfolio = new_broker(api)
        trade = broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "cid1", lambda p: None)
        self.assertEqual(len(api.placed), 1)
        self.assertTrue(trade["fee_estimated"])
        self.assertGreater(portfolio.holdings["BTCUSDT"], 0)

    def test_server_error_is_treated_as_unknown_and_looked_up(self):
        api = FakeTestnet()
        api.fail_next_send = "5xx"
        broker, portfolio = new_broker(api)
        broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "cid5", lambda p: None)
        self.assertEqual(len(api.placed), 1)
        self.assertGreater(portfolio.holdings["BTCUSDT"], 0)

    def test_rejected_order_changes_nothing(self):
        api = FakeTestnet()
        api.fail_next_send = "reject"
        broker, portfolio = new_broker(api)
        seen, store = no_pending_store()
        with self.assertRaisesRegex(RuntimeError, "RECUSADA.*-2010"):
            broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "cid2", store)
        self.assertEqual(portfolio.cash, Decimal("100"))
        self.assertEqual(portfolio.trades, [])
        self.assertIsNone(seen[-1])

    def test_unknown_result_keeps_pending_marker(self):
        api = FakeTestnet()
        api.fail_next_send = "timeout_lost"
        broker, portfolio = new_broker(api)
        seen, store = no_pending_store()
        with self.assertRaisesRegex(RuntimeError, "INCERTA"):
            broker.buy("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "cid3", store)
        self.assertEqual(seen[-1]["client_id"], "cid3")  # still pending
        self.assertEqual(portfolio.trades, [])

    def test_reconcile_detects_missing_testnet_balance(self):
        broker, portfolio = new_broker(FakeTestnet(btc="0"))
        portfolio.holdings["BTCUSDT"] = Decimal("0.001")
        with self.assertRaisesRegex(RuntimeError, "DIVERGENTE"):
            broker.reconcile()

    def test_sell_rounds_down_and_writes_off_dust(self):
        api = FakeTestnet(btc="0.000203")
        broker, portfolio = new_broker(api)
        portfolio.cash = Decimal("90")
        portfolio.holdings["BTCUSDT"] = Decimal("0.0002034")
        trade = broker.sell("BTCUSDT", 50000.0, {"BTCUSDT": 50000.0}, "d", "cs1", lambda p: None)
        self.assertEqual(api.placed[0][2], Decimal("0.00020"))  # floored to step and free balance
        self.assertEqual(portfolio.holdings["BTCUSDT"], 0)
        self.assertEqual(trade["dust_written_off"], "0.0000034")
        self.assertEqual(portfolio.cash, Decimal("90") + Decimal("10.00") - Decimal("0.01000"))

    def test_client_order_id_is_valid_and_bounded(self):
        cid = client_order_id("BUY", "BTCUSDT", "1730000000000")
        self.assertEqual(cid, "cb-B-BTCUSDT-1730000000000")
        with self.assertRaises(ValueError):
            client_order_id("BUY", "X" * 30 + "USDT", "1730000000000")


def bot(api, state_path=None, market=None):
    b = AutonomousPaperBot(market=market or FakeMarket(), symbols=["BTCUSDT"], bots=2,
                           generations=1, retrain_cycles=1000, state_path=state_path,
                           testnet_api=api)
    return b


def forced_buy():
    return [patch("autonomous.evolve_indicators", return_value={"approved_for_paper": True,
                                                                "winner": WINNER}),
            patch("autonomous.trading_signal", return_value={"action": "BUY"}),
            patch("autonomous.market_profile", return_value={"rsi": 50, "atr_percent": 1,
                                                              "regime": "UPTREND"}),
            patch("autonomous.entry_context", return_value={"allow_buy": True, "reasons": [],
                                                             "observation": {}})]


class BotTestnetTests(unittest.TestCase):
    def run_cycle(self, b):
        patches = forced_buy()
        for p in patches:
            p.start()
        try:
            return b.cycle()
        finally:
            for p in patches:
                p.stop()

    def test_bot_buys_on_testnet_once_per_candle(self):
        api = FakeTestnet()
        b = bot(api)
        result = self.run_cycle(b)
        self.assertEqual(result["mode"], "TESTNET")
        self.assertEqual([d["action"] for d in result["decisions"]], ["BUY"])
        self.assertEqual(len(api.placed), 1)
        self.assertTrue(api.placed[0][1].startswith("cb-B-BTCUSDT-"))
        self.assertAlmostEqual(b.entries["BTCUSDT"], 50000 * 1.0005)
        self.run_cycle(b)  # same candle again: no new order
        self.assertEqual(len(api.placed), 1)

    def test_crash_with_pending_order_recovers_without_resending(self):
        api = FakeTestnet()
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "testnet-state.json")
            first = bot(api, path)
            api.fail_next_send = "timeout_lost"
            api.lookup_fails = True
            result = self.run_cycle(first)
            self.assertIn("INCERTA", result["decisions"][0]["reason"])
            with open(path, encoding="utf-8") as stream:
                saved = json.load(stream)
            self.assertEqual(saved["mode"], "TESTNET")
            self.assertIsNotNone(saved["pending_order"])
            # The order actually reached the exchange; the process restarts.
            api.lookup_fails = False
            client_id = saved["pending_order"]["client_id"]
            api._execute("BTCUSDT", "BUY", client_id, quote_quantity="10.00")
            second = bot(api, path)
            self.run_cycle(second)
            self.assertEqual(len(api.placed), 1)  # never resent
            self.assertIsNone(second.pending_order)
            self.assertGreater(second.portfolio.holdings["BTCUSDT"], 0)
            self.assertIn("BTCUSDT", second.entries)
            self.assertTrue(second.portfolio.trades[-1]["recovered"])

    def test_paper_state_cannot_be_reused_as_testnet(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "state.json")
            paper = AutonomousPaperBot(market=FakeMarket(), symbols=["BTCUSDT"], bots=2,
                                       generations=1, state_path=path)
            paper.checkpoint()
            with self.assertRaisesRegex(ValueError, "Incompatible"):
                bot(FakeTestnet(), path)

    def test_divergent_balance_stops_before_any_order(self):
        api = FakeTestnet(btc="0")
        b = bot(api)
        b.portfolio.holdings["BTCUSDT"] = Decimal("0.001")
        b.portfolio.cash = Decimal("50")
        with self.assertRaisesRegex(RuntimeError, "DIVERGENTE"):
            self.run_cycle(b)
        self.assertEqual(api.placed, [])

    def test_paper_mode_fills_at_live_price(self):
        market = FakeMarket()
        market.live = 51000.0
        b = AutonomousPaperBot(market=market, symbols=["BTCUSDT"], bots=2, generations=1,
                               retrain_cycles=1000)
        self.run_cycle(b)
        self.assertEqual(b.portfolio.trades[-1]["price"], str(Decimal("51000.0") * Decimal("1.0005")))
        self.assertAlmostEqual(b.entries["BTCUSDT"], 51000 * 1.0005)

    def test_cli_requires_explicit_testnet_confirmation(self):
        import autonomous
        with patch.object(sys, "argv", ["autonomous.py", "--mode", "testnet", "--once"]), \
             patch("sys.stderr"):
            with self.assertRaises(SystemExit):
                autonomous.main()


if __name__ == "__main__":
    unittest.main()
