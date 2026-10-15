"""Explain observable market movements without inventing causal certainty.

Public Binance Spot data only. Indicators are descriptive, not proof of cause.
"""
from math import isfinite


def explain_market(symbol, candles, ticker=None, btc_change=None):
    if len(candles)<25:
        raise ValueError("At least 25 closed candles required")
    closes=[float(c.close) for c in candles]
    volumes=[float(c.volume) for c in candles]
    if any(not isfinite(x) or x<=0 for x in closes):
        raise ValueError("Invalid prices")
    if any(not isfinite(x) or x<0 for x in volumes):
        raise ValueError("Invalid volume")
    change_24h=(closes[-1]/closes[-25]-1)*100
    avg_volume=sum(volumes[-25:-1])/24
    relative_volume=volumes[-1]/avg_volume if avg_volume else None
    amplitude=(max(c.high for c in candles[-24:])/
               min(c.low for c in candles[-24:])-1)*100
    observations=[]
    if relative_volume is not None:
        if relative_volume>=1.8:
            observations.append("Volume horario elevado frente as 24 horas anteriores")
        elif relative_volume<=0.5:
            observations.append("Volume horario abaixo da media recente")
    if btc_change is not None and symbol!="BTCUSDT":
        if change_24h*btc_change>0:
            observations.append("Movimento na mesma direcao do Bitcoin")
        elif change_24h*btc_change<0:
            observations.append("Movimento divergente do Bitcoin")
    if abs(change_24h)>=5:
        observations.append("Variacao de preco acentuada nas ultimas 24 horas")
    return {
        "symbol":symbol,
        "direction":"UP" if change_24h>0 else "DOWN" if change_24h<0 else "FLAT",
        "closed_candle_change_24h_pct":round(change_24h,3),
        "last_hour_volume_vs_previous_24h":round(relative_volume,3) if relative_volume is not None else None,
        "last_24h_high_low_range_pct":round(amplitude,3),
        "btc_closed_candle_change_24h_pct":btc_change,
        "observations":observations,
        "cause":"UNDETERMINED",
        "confidence_in_causal_explanation":"NONE",
        "missing_evidence":["news","onchain_flows","derivatives_liquidations","order_book"],
        "note":"Correlations and volume do not establish the cause of price movements."
    }
