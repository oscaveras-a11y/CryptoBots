"""Stop/take must never be silently disabled; cycles align to candle close."""
import unittest
from decimal import Decimal
from unittest.mock import patch

from autonomous import AutonomousPaperBot
from trader.indicator_evolution import IndicatorGenome
from trader.strategy import Candle


class FakeMarket:
    def ohlcv(self, symbol, limit):
        return [Candle(100 + i*.01, 100 + i*.01 + 1, 100 + i*.01 - 1, 100) for i in range(220)]


APPROVED = {"approved_for_paper": True,
            "winner": {"fast": 5, "slow": 15, "rsi_buy_max": 65, "rsi_sell_min": 0,
                       "max_atr_percent": 5, "stop": .5, "take": .9}}


def bot_with_position():
    bot = AutonomousPaperBot(market=FakeMarket(), symbols=["BTCUSDT"],
                             bots=2, generations=1, retrain_cycles=1000)
    bot.genome = IndicatorGenome(**APPROVED["winner"])
    bot.approved = True
    bot.cycle_number = 1
    bot.portfolio.holdings["BTCUSDT"] = Decimal("0.1")
    bot.portfolio.cash = Decimal("90")
    return bot


class AutonomousSafetyTests(unittest.TestCase):
    def test_entry_recovered_from_trade_log(self):
        bot = bot_with_position()
        bot.portfolio.trades.append({"side": "BUY", "symbol": "BTCUSDT", "price": "123.5"})
        self.assertEqual(bot.entry_price("BTCUSDT"), 123.5)
        self.assertEqual(bot.entries["BTCUSDT"], 123.5)

    def test_missing_entry_exits_instead_of_disabling_stop(self):
        bot = bot_with_position()
        with patch("autonomous.trading_signal", return_value={"action": "WAIT"}):
            result = bot.cycle()
        self.assertEqual(bot.portfolio.holdings["BTCUSDT"], 0)
        self.assertEqual(result["decisions"][0]["reason"], "MISSING_ENTRY_PRICE")

    def test_known_entry_with_wide_stop_keeps_position(self):
        bot = bot_with_position()
        bot.entries["BTCUSDT"] = 110.0
        with patch("autonomous.trading_signal", return_value={"action": "WAIT"}):
            bot.cycle()
        self.assertEqual(bot.portfolio.holdings["BTCUSDT"], Decimal("0.1"))

    def test_cycle_waits_until_just_after_hour_close(self):
        # 10:59:30 UTC -> wait 30s to the hour plus 20s settle time.
        self.assertEqual(AutonomousPaperBot.seconds_until_next(3600, now=3600*10+3570), 50)
        self.assertEqual(AutonomousPaperBot.seconds_until_next(3600, now=3600*10), 3620)


if __name__ == "__main__":
    unittest.main()
