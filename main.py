import argparse
import json
from trader.market import Market
from trader.evolution import evolve

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--capital", type=float, default=100)
    p.add_argument("--bots", type=int, default=20)
    p.add_argument("--generations", type=int, default=8)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--symbols", type=int, default=8)
    a = p.parse_args()
    if a.capital <= 0 or a.bots < 2 or a.generations < 1 or a.symbols < 1:
        p.error("Parâmetros inválidos")
    market = Market()
    symbols = market.select_symbols(a.symbols)
    data = {s: market.closes(s, 350) for s in symbols}
    report = evolve(data, a.capital, a.bots, a.generations, a.seed)
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
