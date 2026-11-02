"""Honest walk-forward evaluation on exported candles (research only, no orders).

  python3 market_export.py --days 730 --output candles.csv.gz
  python3 evaluate.py candles.csv.gz --timeframe 4

Protocol: train on a window (default 180 days), trade the NEXT window
(default 60 days) that research never saw, slide forward, repeat. A fold only
trades if research approved the strategy; otherwise it stays in cash, exactly
like the live bot. Results are compared with buy-and-hold and with cash.
"""
import argparse
import csv
import gzip
import json
import sys
from dataclasses import asdict

from trader.indicator_evolution import Features, IndicatorGenome, evolve_indicators, replay
from trader.market import align_by_time, resample
from trader.strategies import KINDS
from trader.strategy import Candle


def load_csv(path):
    opener = gzip.open if path.endswith(".gz") else open
    data = {}
    with opener(path, "rt", newline="") as stream:
        for row in csv.DictReader(stream):
            data.setdefault(row["symbol"], []).append(
                Candle(float(row["close"]), float(row["high"]), float(row["low"]),
                       float(row["volume"]), open=float(row["open"]),
                       open_time=int(row["open_time_ms"])))
    for candles in data.values():
        candles.sort(key=lambda c: c.open_time)
    return data


def walk_forward(data, timeframe=4, train_days=180, test_days=60, bots=16, generations=8,
                 seed=42, kinds=KINDS, capital=100.0, train_symbols=None):
    data = align_by_time({s: resample(c, timeframe) for s, c in data.items()})
    symbols = sorted(data)
    train_symbols = sorted(train_symbols or symbols)
    per_day = 24 // timeframe
    n = len(data[symbols[0]])
    train, test = train_days * per_day, test_days * per_day
    features = {s: Features(c) for s, c in data.items()}
    folds = []
    start = 0
    while start + train + test <= n:
        cut, end = start + train, start + train + test
        research = evolve_indicators({s: data[s][start:cut] for s in train_symbols},
                                     capital=capital, bots=bots, generations=generations,
                                     seed=seed + start, kinds=kinds)
        genome = IndicatorGenome(**research["winner"])
        results = {s: replay(data[s], genome, capital, start=cut, end=end, features=features[s])
                   for s in symbols}
        strategy = sum(r["equity"] for r in results.values()) / len(results)
        hold = sum(r["buy_hold_equity"] for r in results.values()) / len(results)
        first, last = data[symbols[0]][cut].open_time, data[symbols[0]][end - 1].open_time
        folds.append({"test_from_ms": first, "test_to_ms": last,
                      "approved": research["approved_for_paper"], "kind": genome.kind,
                      "winner": asdict(genome),
                      "strategy_equity": round(strategy, 4),
                      "traded_equity": round(strategy if research["approved_for_paper"] else capital, 4),
                      "buy_hold_equity": round(hold, 4),
                      "round_trips": sum(r["round_trips"] for r in results.values()),
                      "per_symbol": {s: {"equity": r["equity"], "round_trips": r["round_trips"],
                                         "win": r["winning_round_trips"],
                                         "buy_hold": r["buy_hold_equity"],
                                         "time_in_market": r["time_in_market"]}
                                     for s, r in results.items()}})
        start += test

    def compound(key):
        value = capital
        for fold in folds:
            value *= fold[key] / capital
        return round(value, 4)

    return {"mode": "WALK_FORWARD_RESEARCH", "timeframe_hours": timeframe,
            "symbols": symbols, "train_symbols": train_symbols, "kinds": list(kinds),
            "folds": len(folds), "approved_folds": sum(f["approved"] for f in folds),
            "compounded": {"only_when_approved": compound("traded_equity"),
                           "always_trade_winner": compound("strategy_equity"),
                           "buy_and_hold": compound("buy_hold_equity"),
                           "cash": capital},
            "fold_details": folds,
            "warning": "Pesquisa em dados passados. Nao garante resultado futuro."}


def main():
    p = argparse.ArgumentParser(description="Avaliacao walk-forward honesta (somente pesquisa)")
    p.add_argument("csv")
    p.add_argument("--timeframe", type=int, default=4, choices=(1, 2, 4, 6, 12, 24))
    p.add_argument("--train-days", type=int, default=180)
    p.add_argument("--test-days", type=int, default=60)
    p.add_argument("--bots", type=int, default=16)
    p.add_argument("--generations", type=int, default=8)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--kinds", nargs="+", default=list(KINDS), choices=KINDS)
    p.add_argument("--train-symbols", nargs="+",
                   help="Treinar so nestas moedas e testar em todas (checa generalizacao)")
    p.add_argument("--summary", action="store_true", help="Sem detalhes por janela")
    a = p.parse_args()
    report = walk_forward(load_csv(a.csv), a.timeframe, a.train_days, a.test_days, a.bots,
                          a.generations, a.seed, a.kinds, train_symbols=a.train_symbols)
    if a.summary:
        report["fold_details"] = [{k: f[k] for k in ("approved", "kind", "strategy_equity",
                                                      "buy_hold_equity", "round_trips")}
                                  for f in report["fold_details"]]
    json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
