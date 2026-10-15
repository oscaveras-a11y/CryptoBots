import tempfile
import unittest
from pathlib import Path
from autonomous import AutonomousPaperBot
from trader.indicator_evolution import IndicatorGenome


class PaperPersistenceTests(unittest.TestCase):
    def test_roundtrip_and_configuration_guard(self):
        with tempfile.TemporaryDirectory() as folder:
            path=str(Path(folder)/"state.json")
            first=AutonomousPaperBot(symbols=["BTCUSDT"],state_path=path)
            first.portfolio.cash-=__import__("decimal").Decimal("10")
            first.portfolio.holdings["BTCUSDT"]=__import__("decimal").Decimal("0.001")
            first.entries["BTCUSDT"]=10000.0
            first.last_candle["BTCUSDT"]=((1.,2.,0.5,10.),(2.,3.,1.,11.))
            first.cycle_number=4
            first.genome=IndicatorGenome(5,15,65,30,5,.02,.04)
            first.approved=True
            first.checkpoint()
            second=AutonomousPaperBot(symbols=["BTCUSDT"],state_path=path)
            self.assertEqual(second.portfolio.cash,first.portfolio.cash)
            self.assertEqual(second.portfolio.holdings,first.portfolio.holdings)
            self.assertEqual(second.last_candle,first.last_candle)
            self.assertEqual(second.genome,first.genome)
            with self.assertRaises(ValueError):
                AutonomousPaperBot(symbols=["ETHUSDT"],state_path=path)

    def test_corrupt_state_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"state.json"
            path.write_text("not-json",encoding="utf-8")
            with self.assertRaises(ValueError):
                AutonomousPaperBot(state_path=str(path))
