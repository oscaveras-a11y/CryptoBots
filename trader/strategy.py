"""Conservative, deterministic crypto trading research signals.

Signals are advisory; no exchange orders. Uses ONLY closed candles, with
trend, momentum, volatility and volume confirmation. No profit promises.
"""
from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class Candle:
    close: float
    high: float
    low: float
    volume: float
    # Optional: opening price and Binance open time (ms, UTC). Older saved or
    # synthetic data may lack them; fills then fall back to the prior close.
    open: float = None
    open_time: int = None


def sma(values, period):
    return sum(values[-period:]) / period


def trading_signal(candles, fast=12, slow=36, volume_window=20,
                   max_volatility=0.06, min_volume_ratio=0.75):
    """Evaluate completed hourly candles. Returns BUY, SELL or WAIT.

    WAIT means no new buy, not a command to hold a losing position.
    SELL is a model exit signal, not a guaranteed profitable exit.
    """
    if not 2 <= fast < slow or volume_window < 2:
        raise ValueError("Invalid lookback windows")
    if not 0 < max_volatility < 1 or min_volume_ratio <= 0:
        raise ValueError("Invalid market thresholds")
    if len(candles) < max(slow + 1, volume_window + 1, 16):
        return {"action": "WAIT", "reason": "INSUFFICIENT_CANDLES"}
    for c in candles:
        if (not all(isfinite(v) for v in (c.close, c.high, c.low, c.volume))
                or c.close <= 0 or c.low <= 0 or c.high < c.low
                or not c.low <= c.close <= c.high or c.volume < 0):
            raise ValueError("Invalid OHLCV candle")
    closes = [c.close for c in candles]
    volumes = [c.volume for c in candles]
    short = sma(closes, fast)
    long = sma(closes, slow)
    previous_short = sma(closes[:-1], fast)
    previous_long = sma(closes[:-1], slow)
    average_volume = sum(volumes[-volume_window-1:-1]) / volume_window
    volume_ratio = volumes[-1] / average_volume if average_volume else 0
    ranges = [c.high - c.low for c in candles[-14:]]
    volatility = (sum(ranges) / len(ranges)) / closes[-1]
    if volatility > max_volatility:
        return {"action": "WAIT", "reason": "HIGH_VOLATILITY",
                "volatility": round(volatility, 6)}
    if short < long and previous_short >= previous_long:
        return {"action": "SELL", "reason": "BEARISH_CROSS"}
    if short > long and previous_short <= previous_long:
        if volume_ratio < min_volume_ratio:
            return {"action": "WAIT", "reason": "LOW_VOLUME"}
        return {"action": "BUY", "reason": "BULLISH_CROSS",
                "volume_ratio": round(volume_ratio, 4)}
    return {"action": "WAIT", "reason": "NO_CROSS"}


def eligible_market_order(symbol_info, price, quantity):
    """Local precheck only; exchange filters and reference prices may change."""
    from decimal import Decimal
    from trader.execution import dec
    p, q = dec(price), dec(quantity)
    if p <= 0 or q <= 0 or symbol_info.get("status") != "TRADING":
        return False
    if "MARKET" not in symbol_info.get("orderTypes", []):
        return False
    filters = {f["filterType"]: f for f in symbol_info.get("filters", [])}
    for name in ("LOT_SIZE", "MARKET_LOT_SIZE"):
        f = filters.get(name)
        if not f:
            continue
        minimum = dec(f.get("minQty", 0))
        maximum = dec(f.get("maxQty", 0))
        step = dec(f.get("stepSize", 0))
        if q < minimum or (maximum and q > maximum) or (step and q % step):
            return False
    notional = p * q
    f = filters.get("MIN_NOTIONAL", {})
    if f.get("applyToMarket") and notional < dec(f.get("minNotional", 0)):
        return False
    f = filters.get("NOTIONAL", {})
    if f.get("applyMinToMarket") and notional < dec(f.get("minNotional", 0)):
        return False
    if f.get("applyMaxToMarket") and notional > dec(f.get("maxNotional", 0)):
        return False
    return True
