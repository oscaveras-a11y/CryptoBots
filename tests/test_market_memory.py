import tempfile
import unittest
from pathlib import Path
from trader.market_memory import MarketMemory


class MarketMemoryTests(unittest.TestCase):
    def test_observations_decisions_and_future_outcome(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"market.sqlite3"
            memory=MarketMemory(path)
            for i in range(26):
                obs={"closed_candle_change_24h_pct":i/10,
                     "direction":"UP","last_hour_volume_vs_previous_24h":1}
                memory.observe("BTCUSDT",str(i),obs,100+i)
            memory.decide("BTCUSDT","0","BUY","CONFIRMED_SIGNAL",100,
                          {"indicator":"MA_CROSS"})
            memory.decide("BTCUSDT","0","BUY","CONFIRMED_SIGNAL",100)
            memory.settle_prior("BTCUSDT")
            row=memory.db.execute("SELECT outcome_24h_pct FROM decisions").fetchone()
            self.assertEqual(row[0],24.0)
            self.assertEqual(memory.db.execute(
                "SELECT COUNT(*) FROM decisions").fetchone()[0],1)
            self.assertEqual(len(memory.summary()["markets"]),1)
            memory.close()
            reopened=MarketMemory(path)
            self.assertEqual(len(reopened.summary()["markets"]),1)
            reopened.close()
