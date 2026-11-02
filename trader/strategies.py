"""Strategy families shared by the backtest, the autonomous bot and the colony.

One source of truth: every caller asks `wants_entry` / `exit_reason` with a
snapshot of CLOSED candles (indicators of candles[:k]) and the fill price.
No orders here, no profit guarantees.

Families (genome.kind):
- ma_cross: the original moving-average crossover with RSI/volatility filters,
  fixed percentage stop and take profit.
- trend: EMA fast/slow crossover, optional long-trend filter; exits with an ATR
  stop, an ATR trailing stop (lets winners run) or when the EMAs cross back.
- breakout: close above the highest high of the last N candles (Donchian);
  exits below the lowest low of the last M candles, ATR stop or trailing stop.
- mean_reversion: close below the lower Bollinger band with low RSI, ideally
  inside a longer uptrend; exits at the mean (20-period average), ATR stop or
  after a maximum number of candles.
"""
from dataclasses import dataclass
from statistics import mean, pstdev

KINDS = ("ma_cross", "trend", "breakout", "mean_reversion")
BOLLINGER_PERIOD = 20


@dataclass
class Position:
    entry: float          # fill price including slippage
    highest: float        # highest closed price since entry (trailing stop)
    entry_atr: float      # ATR when the position was opened
    held: int = 0         # completed candles since entry


def required_history(g):
    """Candles needed before the genome can decide anything."""
    need = [51, g.slow + 2]
    if g.trend_len:
        need.append(g.trend_len + 2)
    if g.kind == "breakout":
        need += [g.channel + 2, g.exit_channel + 2]
    if g.kind == "mean_reversion":
        need.append(BOLLINGER_PERIOD + 2)
    return max(need)


def wants_entry(s, g):
    """True when genome g would buy, seeing snapshot s of closed candles."""
    if g.kind == "ma_cross":
        p = s.profile()
        return (s.ma_signal(g.fast, g.slow) == "BUY" and p["rsi"] <= g.rsi_buy_max
                and p["atr_percent"] <= g.max_atr_percent
                and p["regime"] != "HIGH_VOLATILITY")
    close = s.last_close()
    if s.atr() / close * 100 > g.max_atr_percent:
        return False
    if g.trend_len and close <= s.ema(g.trend_len):
        return False
    if g.kind == "trend":
        return (s.ema(g.fast) > s.ema(g.slow)
                and s.ema(g.fast, previous=True) <= s.ema(g.slow, previous=True))
    if g.kind == "breakout":
        return close > s.donchian_high(g.channel)
    if g.kind == "mean_reversion":
        middle, deviation = s.bollinger()
        return close < middle - g.band_k * deviation and s.rsi() < g.oversold
    raise ValueError("Unknown strategy kind: %s" % g.kind)


def open_position(s, g, fill_price):
    return Position(entry=fill_price, highest=fill_price, entry_atr=s.atr())


def advance(position, s):
    """Call once per new closed candle while holding, before exit_reason."""
    position.highest = max(position.highest, s.last_close())
    position.held += 1


def exit_reason(s, g, position, price):
    """Reason to sell at `price` now, or None to keep holding."""
    if g.kind == "ma_cross":
        p = s.profile()
        if (price <= position.entry * (1 - g.stop) or price >= position.entry * (1 + g.take)
                or s.ma_signal(g.fast, g.slow) == "SELL" or p["rsi"] < g.rsi_sell_min):
            return "EXIT"
        return None
    if price <= position.entry - g.atr_stop * position.entry_atr:
        return "ATR_STOP"
    if g.trail and price <= position.highest - g.trail * s.atr():
        return "TRAILING_STOP"
    if g.take and price >= position.entry * (1 + g.take):
        return "TAKE_PROFIT"
    if g.max_hold and position.held >= g.max_hold:
        return "TIME_STOP"
    if g.kind == "trend" and s.ema(g.fast) < s.ema(g.slow):
        return "TREND_END"
    if g.kind == "breakout" and s.last_close() < s.donchian_low(g.exit_channel):
        return "CHANNEL_EXIT"
    if g.kind == "mean_reversion" and s.last_close() >= s.bollinger()[0]:
        return "MEAN_REACHED"
    return None


class Snapshot:
    """Indicators of candles[:k] backed by precomputed Features."""

    def __init__(self, features, k):
        self.f, self.k = features, k

    def profile(self):
        return self.f.profile(self.k)

    def ma_signal(self, fast, slow):
        return self.f.signal(self.k, fast, slow)

    def last_close(self):
        return self.f.closes[self.k - 1]

    def ema(self, period, previous=False):
        return self.f.ema(period)[self.k - 1 if previous else self.k]

    def atr(self):
        return self.f.atr_values[self.k]

    def rsi(self):
        return self.f.rsi_values[self.k]

    def donchian_high(self, n):
        return self.f.donchian_high(n)[self.k]

    def donchian_low(self, n):
        return self.f.donchian_low(n)[self.k]

    def bollinger(self):
        return self.f.bollinger()[self.k]


def bollinger_at(closes, k, period=BOLLINGER_PERIOD):
    window = closes[k - period:k]
    return mean(window), pstdev(window)
