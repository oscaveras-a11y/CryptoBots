"""Export closed hourly candles from Binance public data to a compressed CSV.

Research only: no keys, no orders. Example (about 2 years, 8 pairs):
  python3 market_export.py --days 730 --output candles.csv.gz
"""
import argparse
import csv
import gzip
import sys

from trader.market import Market

DEFAULT = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "DOGEUSDT",
           "ADAUSDT", "LINKUSDT"]


def main():
    p = argparse.ArgumentParser(description="Exportar candles de 1h (dados publicos)")
    p.add_argument("--days", type=int, default=730)
    p.add_argument("--symbols", nargs="+", default=DEFAULT)
    p.add_argument("--output", default="candles.csv.gz")
    a = p.parse_args()
    market = Market()
    with gzip.open(a.output, "wt", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["symbol", "open_time_ms", "open", "high", "low", "close", "volume"])
        for symbol in a.symbols:
            try:
                candles = market.ohlcv(symbol, a.days * 24)
            except RuntimeError as exc:
                print("pulando %s: %s" % (symbol, exc), file=sys.stderr)
                continue
            for c in candles:
                writer.writerow([symbol, c.open_time, c.open, c.high, c.low, c.close, c.volume])
            print("%s: %d candles" % (symbol, len(candles)), file=sys.stderr)
    print("arquivo salvo: " + a.output, file=sys.stderr)


if __name__ == "__main__":
    main()
