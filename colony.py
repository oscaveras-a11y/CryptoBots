"""Colony of evolving PAPER bots: profitable bots reproduce, losing bots die.

SIMULATION ONLY: never sends orders (not even to the testnet).

  python colony.py --backtest --days 180      # research + colony on unseen data
  python colony.py --live                     # hourly paper colony, state saved

Live mode seeds bots only from a research-approved strategy. If every bot dies,
research runs again at most once a day before re-seeding from the pool.
"""
import argparse
import json
import logging
import os
import tempfile
import time
from pathlib import Path

from trader.colony import (Colony, ColonyConfig, HOUR_MS, View, candle_day, run_backtest,
                           seed_genomes)
from trader.indicator_evolution import Features, evolve_indicators
from trader.market import Market, align_by_time

LOG = logging.getLogger("cryptobots.colony")


def atomic_write(path, data):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".colony-", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class LiveColony:
    """Hourly paper colony on public Binance data, persisted after every step."""

    def __init__(self, market, symbols, config, state_path, history_candles=2160,
                 bots=12, generations=5):
        self.market, self.symbols, self.state_path = market, sorted(symbols), state_path
        self.history_candles, self.bots, self.generations = history_candles, bots, generations
        self.last_research_t = None
        self.last_research = None
        path = Path(state_path)
        if path.exists():
            with path.open(encoding="utf-8") as stream:
                state = json.load(stream)
            if state.get("symbols") != self.symbols:
                raise ValueError("Estado da colonia usa outras moedas; use outro --state")
            self.colony = Colony.from_dict(state["colony"])
            self.last_research_t = state.get("last_research_t")
        else:
            self.colony = Colony(config)

    def save(self):
        atomic_write(self.state_path, {"symbols": self.symbols, "colony": self.colony.to_dict(),
                                       "last_research_t": self.last_research_t})

    def current_price(self, symbol, candles):
        getter = getattr(self.market, "price", None)
        return float(getter(symbol)) if callable(getter) else candles[-1].close

    def cycle(self):
        data = align_by_time({s: self.market.ohlcv(s, self.history_candles) for s in self.symbols})
        first = data[self.symbols[0]]
        n = len(first)
        t = first[-1].open_time // HOUR_MS if first[-1].open_time is not None else n
        c = self.colony.config
        if (not self.colony.alive() and self.colony.pool >= c.min_bot_capital
                and (self.last_research_t is None or t - self.last_research_t >= 24)):
            research = evolve_indicators(data, capital=c.capital, bots=self.bots,
                                         generations=self.generations, seed=c.seed + t)
            self.last_research_t = t
            self.last_research = research
            LOG.info("research approved=%s winner=%s", research["approved_for_paper"],
                     research["winner"])
            if research["approved_for_paper"]:
                self.colony.seed(seed_genomes(research["winner"], c.initial_bots, c.seed + t),
                                 self.symbols, t)
        features = {s: Features(candles) for s, candles in data.items()}
        views = {s: View(features[s].profile(n),
                         (lambda fast, slow, f=features[s]: f.signal(n, fast, slow)),
                         self.current_price(s, data[s])) for s in self.symbols}
        events = self.colony.step(t, candle_day(first[-1], n), views)
        self.save()
        summary = self.colony.summary({s: v.price for s, v in views.items()})
        summary["new_events"] = events
        if not self.colony.alive():
            summary["note"] = ("Sem bots vivos: aguardando pesquisa aprovar uma estrategia."
                               if self.colony.pool >= c.min_bot_capital else
                               "Caixa abaixo do minimo para novos bots.")
        return summary

    def run(self, interval=3600, once=False):
        while True:
            try:
                LOG.info("colony %s", json.dumps(self.cycle(), ensure_ascii=False))
            except Exception:
                LOG.exception("Ciclo da colonia falhou; estado anterior preservado")
                if once:
                    raise
            if once:
                return
            time.sleep(interval - (time.time() % interval) + 20)


def main():
    p = argparse.ArgumentParser(description="Colonia evolutiva de bots (somente simulacao)")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--backtest", action="store_true", help="Padrao: pesquisa + colonia em dados nao vistos")
    mode.add_argument("--live", action="store_true", help="Colonia ao vivo em simulacao, a cada hora")
    p.add_argument("--once", action="store_true")
    p.add_argument("--symbols", nargs="+", default=["BTCUSDT", "ETHUSDT"])
    p.add_argument("--days", type=int, default=None,
                   help="Historico de 1h (padrao: 180 no backtest, 90 ao vivo)")
    p.add_argument("--capital", type=float, default=100.0)
    p.add_argument("--max-bots", type=int, default=10)
    p.add_argument("--initial-bots", type=int, default=4)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--state", default="data/colony-state.json")
    p.add_argument("--ignore-approval", action="store_true",
                   help="So backtest: cria a colonia mesmo se a pesquisa reprovar (estudo)")
    a = p.parse_args()
    days = a.days or (90 if a.live else 180)
    if days < 10:
        p.error("--days deve ser pelo menos 10")
    config = ColonyConfig(capital=a.capital, max_bots=a.max_bots,
                          initial_bots=a.initial_bots, seed=a.seed)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    market = Market()
    if a.live:
        LiveColony(market, a.symbols, config, a.state, history_candles=days * 24).run(once=a.once)
        return
    data = align_by_time({s: market.ohlcv(s, days * 24) for s in a.symbols})
    report = run_backtest(data, config, ignore_approval=a.ignore_approval)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
