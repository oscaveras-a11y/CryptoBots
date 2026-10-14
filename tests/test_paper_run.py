import json
import tempfile
import unittest
from pathlib import Path
from paper_run import replay, atomic_json
from trader.evolution import Genome

class ReplayTests(unittest.TestCase):
    def test_replay_no_real_orders(self):
        prices = [100 + i*.2 for i in range(120)]
        report = replay(prices, Genome(5,20,.02,.04))
        self.assertEqual(report['mode'],'OFFLINE_PAPER')
        self.assertTrue(all(t['mode']=='PAPER' for t in report['trades']))
        self.assertLessEqual(float(report['cash']),100)

    def test_atomic_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'snapshot.json'
            atomic_json(path, {'mode':'OFFLINE_PAPER','value':'100'})
            self.assertEqual(json.loads(path.read_text())['value'],'100')

    def test_rejects_bad_prices(self):
        with self.assertRaises(ValueError):
            replay([100]*100 + [-1],Genome(5,20,.02,.04))
