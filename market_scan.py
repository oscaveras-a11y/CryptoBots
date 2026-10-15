"""Scan liquid Spot pairs and produce explainable market observations."""
import argparse
import json
from trader.market import Market
from trader.market_explain import explain_market


def scan(market=None, limit=30):
    if limit<1:
        raise ValueError("limit must be positive")
    market=market or Market()
    symbols=market.select_symbols(limit)
    btc=market.ohlcv("BTCUSDT",180)
    btc_change=(btc[-1].close/btc[-25].close-1)*100
    reports=[]
    errors={}
    for symbol in symbols:
        try:
            candles=btc if symbol=="BTCUSDT" else market.ohlcv(symbol,180)
            reports.append(explain_market(symbol,candles,btc_change=btc_change))
        except (RuntimeError,ValueError,OSError) as exc:
            errors[symbol]=str(exc)
    return {"mode":"RESEARCH_ONLY","scanned":len(reports),
            "requested":len(symbols),"reports":reports,"errors":errors}


def main():
    parser=argparse.ArgumentParser(description="CryptoBots market research scanner")
    parser.add_argument("--limit",type=int,default=30)
    args=parser.parse_args()
    print(json.dumps(scan(limit=args.limit),indent=2,ensure_ascii=False))


if __name__=="__main__":
    main()
