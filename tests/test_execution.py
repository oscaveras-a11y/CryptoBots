import unittest
from decimal import Decimal
from unittest.mock import patch
from trader.execution import BinanceSpotTestnet, Limits, PaperPortfolio, TESTNET

class ExecutionTests(unittest.TestCase):
    def test_paper_limits_allocation_and_fees(self):
        p = PaperPortfolio()
        q = p.buy('BTCUSDT', 100, {'BTCUSDT':100}, '2026-10-14')
        self.assertLessEqual(p.cash, Decimal('90'))
        self.assertGreater(q, 0)
        p.sell('BTCUSDT', 100, {'BTCUSDT':100}, '2026-10-14')
        self.assertLess(p.cash, 100)
        self.assertEqual(len(p.trades),2)

    def test_loss_circuit_breaker_and_exit(self):
        p = PaperPortfolio()
        p.buy('BTCUSDT', 100, {'BTCUSDT':100}, '2026-10-14')
        with self.assertRaisesRegex(RuntimeError, 'TOTAL_LOSS_LIMIT'):
            p.check({'BTCUSDT':1}, '2026-10-14')
        p.sell('BTCUSDT', 1, {'BTCUSDT':1}, '2026-10-14')

    def test_invalid_limits(self):
        with self.assertRaises(ValueError):
            Limits(max_allocation=Decimal('1.2'))

    def test_testnet_only_and_signed_test_order(self):
        self.assertIn('testnet.binance.vision', TESTNET)
        client = BinanceSpotTestnet('testkey','testsecret')
        with patch('trader.execution.urlopen') as open_url:
            response = open_url.return_value.__enter__.return_value
            response.read.return_value = b'{}'
            client.test_order('BTCUSDT','BUY','0.001')
            req = open_url.call_args.args[0]
            self.assertTrue(req.full_url.startswith(TESTNET+'order/test'))
            self.assertEqual(req.get_method(),'POST')
            self.assertIn(b'signature=', req.data)
        with self.assertRaises(ValueError):
            client.test_order('BTCUSDT','BUY','-1')
