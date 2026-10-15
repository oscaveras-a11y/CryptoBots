"""Shared paper-wallet invariants: independent strategies cannot overspend."""
import unittest
from decimal import Decimal
from trader.execution import Limits, PaperPortfolio


class SharedPaperWalletTests(unittest.TestCase):
    def test_two_strategies_share_only_available_cash(self):
        wallet=PaperPortfolio(Limits(capital=Decimal("100"),max_allocation=Decimal(".25")))
        prices={"BTCUSDT":Decimal("100"),"ETHUSDT":Decimal("100")}
        wallet.buy("BTCUSDT",100,prices,"2026-10-15")
        wallet.buy("ETHUSDT",100,prices,"2026-10-15")
        self.assertEqual(len(wallet.trades),2)
        self.assertGreaterEqual(wallet.cash,0)
        self.assertLess(wallet.cash,Decimal("100"))
        self.assertGreater(wallet.holdings["BTCUSDT"],0)
        self.assertGreater(wallet.holdings["ETHUSDT"],0)
        with self.assertRaises(ValueError):
            wallet.buy("BTCUSDT",100,prices,"2026-10-15")

    def test_sell_releases_cash_for_other_strategy(self):
        wallet=PaperPortfolio()
        prices={"BTCUSDT":100,"ETHUSDT":100}
        wallet.buy("BTCUSDT",100,prices,"2026-10-15")
        after_buy=wallet.cash
        wallet.sell("BTCUSDT",100,prices,"2026-10-15")
        self.assertGreater(wallet.cash,after_buy)
        wallet.buy("ETHUSDT",100,prices,"2026-10-15")
        self.assertGreater(wallet.holdings["ETHUSDT"],0)
