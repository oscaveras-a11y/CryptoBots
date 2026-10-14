import tempfile
import unittest
from pathlib import Path
from trader.fiscal import FiscalLedger

class FiscalTests(unittest.TestCase):
    def test_record_export_and_duplicate_protection(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = FiscalLedger(Path(directory)/"fiscal.db")
            operation = dict(external_id="order-001", exchange="EXAMPLE",
                             exchange_country="BR", occurred_at="2026-10-14T12:00:00-03:00",
                             asset="BTC", side="BUY", quantity="0.00001",
                             unit_price_brl="500000", fee_brl="0.01")
            ledger.record(**operation)
            with self.assertRaises(Exception):
                ledger.record(**operation)
            self.assertEqual(len(ledger.monthly_rows(2026,10)),1)
            self.assertEqual(len(ledger.monthly_rows(2026,10,simulated=False)),0)
            output = ledger.export_csv(2026,10,Path(directory)/"out.csv")
            self.assertTrue(output.exists())
            ledger.close()

    def test_rejects_invalid_values(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = FiscalLedger(Path(directory)/"fiscal.db")
            base = dict(external_id="x", exchange="EXAMPLE",exchange_country="BR",
                        occurred_at="2026-10-14T15:00:00Z",asset="BTC",
                        side="BUY",quantity="1",unit_price_brl="100")
            with self.assertRaises(ValueError):
                ledger.record(**{**base,"quantity":"-1"})
            with self.assertRaises(ValueError):
                ledger.record(**{**base,"unit_price_brl":"NaN"})
            with self.assertRaises(ValueError):
                ledger.record(**{**base,"occurred_at":"2026-10-14T15:00:00"})
            ledger.close()
