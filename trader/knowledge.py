"""Pure technical indicators for research with closed candles only."""
from math import isfinite
from statistics import mean


def ema(values, period):
    if period < 2 or len(values) < period or any(not isfinite(x) for x in values):
        raise ValueError("Invalid EMA input")
    result = mean(values[:period])
    for value in values[period:]:
        result += 2 * (value - result) / (period + 1)
    return result


def rsi(values, period=14):
    if period < 2 or len(values) <= period or any(not isfinite(x) for x in values):
        raise ValueError("Invalid RSI input")
    changes = [b-a for a,b in zip(values[:-1],values[1:])]
    gain = mean([max(0,x) for x in changes[:period]])
    loss = mean([max(0,-x) for x in changes[:period]])
    for change in changes[period:]:
        gain = (gain*(period-1)+max(0,change))/period
        loss = (loss*(period-1)+max(0,-change))/period
    if loss == 0:
        return 100.0 if gain else 50.0
    return 100-100/(1+gain/loss)


def atr(candles, period=14):
    if period < 2 or len(candles) <= period:
        raise ValueError("Insufficient ATR history")
    ranges = []
    for previous, candle in zip(candles[:-1],candles[1:]):
        values = (previous.close, candle.close, candle.high, candle.low)
        if any(not isfinite(x) or x <= 0 for x in values):
            raise ValueError("Invalid candle")
        if candle.high < max(candle.close,candle.low):
            raise ValueError("Invalid OHLC")
        ranges.append(max(candle.high-candle.low,
                          abs(candle.high-previous.close),
                          abs(candle.low-previous.close)))
    value = mean(ranges[:period])
    for x in ranges[period:]:
        value = (value*(period-1)+x)/period
    return value


def market_profile(candles):
    if len(candles) < 51:
        raise ValueError("At least 51 completed candles required")
    for candle in candles:
        if (not all(isfinite(x) for x in
                    (candle.close,candle.high,candle.low,candle.volume))
            or candle.low <= 0 or candle.high < candle.low
            or not candle.low <= candle.close <= candle.high
            or candle.volume < 0):
            raise ValueError("Invalid OHLCV")
    closes = [c.close for c in candles]
    fast,slow,long = (ema(closes,p) for p in (12,26,50))
    volatility = atr(candles)/closes[-1]
    avg_volume = mean(c.volume for c in candles[-21:-1])
    ratio = candles[-1].volume/avg_volume if avg_volume else 0
    if volatility > .055:
        regime = "HIGH_VOLATILITY"
    elif fast > slow > long:
        regime = "UPTREND"
    elif fast < slow < long:
        regime = "DOWNTREND"
    else:
        regime = "RANGE_OR_TRANSITION"
    return {"regime":regime,"rsi":round(rsi(closes),3),
            "atr_percent":round(volatility*100,3),
            "volume_ratio":round(ratio,3)}


def risk_quantity(equity, entry, stop, risk_fraction="0.005", fee_fraction="0.002"):
    from trader.capital import amount
    balance, price, exit_price = amount(equity),amount(entry),amount(stop)
    risk, fees = amount(risk_fraction),amount(fee_fraction)
    if price <= 0 or exit_price <= 0 or exit_price >= price or not 0 < risk <= 1:
        raise ValueError("Invalid risk inputs")
    per_unit = price-exit_price+price*fees
    return min(balance*risk/per_unit, balance/(price*(1+fees)))
