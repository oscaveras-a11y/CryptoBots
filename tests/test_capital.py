import threading
import unittest
from decimal import Decimal
from trader.capital import SharedCapital


class CapitalTests(unittest.TestCase):
    def test_competing_bots_cannot_double_spend(self):
        bank = SharedCapital("100",fee_reserve="0",max_order_fraction="1")
        results = []
        lock = threading.Lock()

        def worker(i):
            try:
                token = bank.reserve(f"bot-{i}", "100")
                with lock:
                    results.append(token)
            except ValueError:
                pass

        threads = [threading.Thread(target=worker,args=(i,)) for i in range(20)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(len(results), 1)
        self.assertEqual(bank.snapshot()["available"], "0")

    def test_fill_and_sale_return_money_to_pool(self):
        bank = SharedCapital("100",fee_reserve="0",max_order_fraction="1")
        token = bank.reserve("a","30")
        bank.commit_buy(token.id,"29")
        self.assertEqual(Decimal(bank.snapshot()["available"]),Decimal("71"))
        bank.credit_sell("32")
        self.assertEqual(Decimal(bank.snapshot()["available"]),Decimal("103"))

    def test_cancel_restores_balance(self):
        bank = SharedCapital("100")
        token = bank.reserve("a","10")
        bank.cancel(token.id)
        self.assertEqual(Decimal(bank.snapshot()["free"]),Decimal("100"))

    def test_invalid_and_overspend(self):
        bank = SharedCapital("100")
        with self.assertRaises(ValueError):
            bank.reserve("a", "-1")
        token = bank.reserve("a","10")
        with self.assertRaises(ValueError):
            bank.commit_buy(token.id,"11")
        self.assertEqual(bank.snapshot()["reservations"],1)
        with self.assertRaises(RuntimeError):
            bank.reconcile("50")
        bank.cancel(token.id)
        bank.reconcile("50")
        self.assertEqual(Decimal(bank.snapshot()["free"]),Decimal("50"))

    def test_rejects_nonfinite(self):
        with self.assertRaises(ValueError):
            SharedCapital("NaN")
