import json
import tempfile
import unittest
from pathlib import Path
from status import report

class StatusTests(unittest.TestCase):
    def test_reports_agents(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"state.json"
            state={"schema":1,"mode":"PAPER_ONLY","cash":"70",
                   "holdings":{"BTCUSDT":"0.01","ETHUSDT":"0.2"},
                   "position_owners":{"BTCUSDT":"strategy:BTCUSDT",
                                      "ETHUSDT":"strategy:ETHUSDT"},
                   "entries":{},"trades":[],"cycle_number":5,"approved":True}
            path.write_text(json.dumps(state),encoding="utf-8")
            result=report(path)
            self.assertEqual(result["free_quote_balance"],"70")
            self.assertEqual(len(result["open_positions"]),2)
