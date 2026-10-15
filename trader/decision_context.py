"""Conservative entry-only context gate for the paper decision engine.

Observable price/volume patterns are not explanations of causality.
Exits are never blocked by this gate.
"""
from trader.market_explain import explain_market


def entry_context(symbol, candles, btc_change=None):
    observation=explain_market(symbol,candles,btc_change=btc_change)
    reasons=[]
    move=observation["closed_candle_change_24h_pct"]
    relative=observation["last_hour_volume_vs_previous_24h"]
    if move<=-8:
        reasons.append("SHARP_24H_DECLINE")
    if move>=12:
        reasons.append("EXTENDED_24H_RALLY")
    if relative is not None and relative>=4:
        reasons.append("EXTREME_VOLUME_SPIKE")
    if (symbol!="BTCUSDT" and btc_change is not None
            and btc_change<=-5):
        reasons.append("BITCOIN_MARKET_STRESS")
    return {"allow_buy":not reasons,"reasons":reasons,
            "observation":observation}
