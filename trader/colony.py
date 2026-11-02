"""Colony of competing PAPER bots: profitable bots reproduce, losing bots die.

SIMULATION ONLY. No exchange orders of any kind are sent from this module.

Rules (all configurable in ColonyConfig):
- The colony starts by seeding a few bots from a research-approved genome
  (the winner plus small mutations). Each bot gets its own cash; the rest of
  the money stays in a common pool.
- A bot trades one symbol with the same indicator rules and fill model as the
  backtest (decision on closed candles, fill at the next price).
- Reproduction: only after >= 10 completed round trips since its last
  reproduction AND equity >= +5% over its baseline. The child is a mutated copy
  funded by half of the parent's profit, topped up from the pool to the minimum
  bot size. Lucky single trades never reproduce.
- Death: equity <= -8% from its baseline, or no completed trade for 14 days.
  Any open position is closed and the remaining cash goes back to the pool.
- Colony-wide limits: max bots, 10% of colony equity per buy, 50% of colony
  equity in open positions, 3% daily / 8% total loss halt new buys and births
  (exits are always allowed).
"""
import random
from dataclasses import asdict, dataclass, fields
from datetime import datetime, timezone

from trader.indicator_evolution import Features, IndicatorGenome, _mutate, evolve_indicators

MIN_ORDER_QUOTE = 5.0  # Binance spot minimum notional for common USDT pairs
HOUR_MS = 3_600_000


@dataclass(frozen=True)
class ColonyConfig:
    capital: float = 100.0
    initial_bots: int = 4
    initial_allocation: float = 0.6
    max_bots: int = 10
    min_bot_capital: float = 10.0
    reproduce_min_round_trips: int = 10
    reproduce_profit: float = 0.05
    child_profit_share: float = 0.5
    death_loss: float = 0.08
    max_idle_hours: int = 24 * 14
    max_position_fraction: float = 0.10
    max_total_exposure: float = 0.50
    colony_daily_loss: float = 0.03
    colony_total_loss: float = 0.08
    fee: float = 0.001
    slippage: float = 0.0005
    seed: int = 42

    def __post_init__(self):
        if self.capital <= 0 or self.initial_bots < 1 or self.max_bots < self.initial_bots:
            raise ValueError("Invalid colony size")
        if self.min_bot_capital < MIN_ORDER_QUOTE:
            raise ValueError("min_bot_capital below exchange minimum order")
        for name in ("initial_allocation", "child_profit_share", "death_loss",
                     "max_position_fraction", "max_total_exposure",
                     "colony_daily_loss", "colony_total_loss"):
            if not 0 < getattr(self, name) <= 1:
                raise ValueError("Invalid " + name)
        if self.reproduce_min_round_trips < 1 or self.reproduce_profit <= 0:
            raise ValueError("Invalid reproduction rule")
        if self.max_idle_hours < 1 or self.fee < 0 or self.slippage < 0:
            raise ValueError("Invalid colony costs or idle limit")


@dataclass
class Agent:
    id: str
    parent: str
    generation: int
    symbol: str
    genome: dict
    cash: float
    baseline: float
    born_at: int
    last_activity: int
    units: float = 0.0
    entry: float = None
    cost_basis: float = 0.0
    round_trips: int = 0
    trips_since_reproduction: int = 0
    winning_round_trips: int = 0
    children: int = 0
    alive: bool = True
    death_reason: str = None
    died_at: int = None
    birth_capital: float = 0.0

    def equity(self, price, fee, slippage):
        return self.cash + self.units * price * (1 - fee - slippage)


@dataclass
class View:
    """What a bot may see at one step: indicators of CLOSED candles and the fill price."""
    profile: dict
    signal: object  # callable(fast, slow) -> "BUY" | "SELL" | "WAIT"
    price: float


def seed_genomes(winner, count, seed):
    """The research winner plus (count-1) small, deterministic mutations of it."""
    base = winner if isinstance(winner, IndicatorGenome) else IndicatorGenome(**winner)
    rng = random.Random("seed-genomes-%s" % seed)
    return [base] + [_mutate(base, rng) for _ in range(count - 1)]


class Colony:
    def __init__(self, config=ColonyConfig()):
        self.config = config
        self.pool = float(config.capital)
        self.agents = []
        self.next_id = 1
        self.last_t = None
        self.day = None
        self.start_of_day = float(config.capital)
        self.halted = None
        self.events = []
        self.history = []
        self.births = 0
        self.deaths = {}

    # --- accounting ------------------------------------------------------------
    def alive(self):
        return [a for a in self.agents if a.alive]

    def equity(self, prices):
        c = self.config
        return self.pool + sum(a.equity(prices[a.symbol], c.fee, c.slippage)
                               for a in self.alive() if a.symbol in prices)

    def exposure(self, prices):
        c = self.config
        return sum(a.units * prices[a.symbol] * (1 - c.fee - c.slippage)
                   for a in self.alive() if a.units and a.symbol in prices)

    def _log(self, t, event, agent=None, **detail):
        record = {"t": t, "event": event}
        if agent is not None:
            record["bot"] = agent.id
        record.update(detail)
        self.events.append(record)
        del self.events[:-1000]  # bounded log
        return record

    def _new_agent(self, parent, generation, symbol, genome, cash, t):
        agent = Agent(id="b%d" % self.next_id, parent=parent, generation=generation,
                      symbol=symbol, genome=asdict(genome), cash=cash, baseline=cash,
                      born_at=t, last_activity=t, birth_capital=cash)
        self.next_id += 1
        self.births += 1
        return agent

    # --- life cycle --------------------------------------------------------------
    def seed(self, genomes, symbols, t):
        """Create bots from research-approved genomes, funded from the pool."""
        c = self.config
        room = c.max_bots - len(self.alive())
        count = min(c.initial_bots, room)
        if count <= 0 or not symbols or not genomes:
            return []
        budget = self.pool * c.initial_allocation
        while count and budget / count < c.min_bot_capital:
            count -= 1
        created = []
        for i in range(count):
            agent = self._new_agent(None, 1, symbols[i % len(symbols)],
                                    genomes[i % len(genomes)], budget / count, t)
            self.pool -= agent.cash
            self.agents.append(agent)
            created.append(agent)
            self._log(t, "BIRTH", agent, symbol=agent.symbol, capital=round(agent.cash, 4),
                      parent=None)
        return created

    def _buy(self, agent, amount, price, t):
        c = self.config
        agent.entry = price * (1 + c.slippage)
        agent.units = amount * (1 - c.fee) / agent.entry
        agent.cost_basis = amount
        agent.cash -= amount
        self._log(t, "BUY", agent, symbol=agent.symbol, amount=round(amount, 4),
                  price=price)

    def _sell(self, agent, price, t, reason):
        c = self.config
        proceeds = agent.units * price * (1 - c.fee - c.slippage)
        agent.cash += proceeds
        agent.units = 0.0
        agent.entry = None
        agent.round_trips += 1
        agent.trips_since_reproduction += 1
        won = proceeds > agent.cost_basis
        agent.winning_round_trips += int(won)
        agent.last_activity = t
        self._log(t, "SELL", agent, symbol=agent.symbol, proceeds=round(proceeds, 4),
                  price=price, reason=reason, won=won)

    def _kill(self, agent, reason, price, t):
        if agent.units:
            self._sell(agent, price, t, "DEATH")
        self.pool += agent.cash
        returned = agent.cash
        agent.cash = 0.0
        agent.alive = False
        agent.death_reason = reason
        agent.died_at = t
        self.deaths[reason] = self.deaths.get(reason, 0) + 1
        self._log(t, "DEATH", agent, reason=reason, returned_to_pool=round(returned, 4))

    def _maybe_reproduce(self, agent, t, births):
        c = self.config
        if self.halted or len(self.alive()) + len(births) >= c.max_bots:
            return
        if agent.units or agent.trips_since_reproduction < c.reproduce_min_round_trips:
            return
        if agent.cash < agent.baseline * (1 + c.reproduce_profit):
            return
        from_parent = (agent.cash - agent.baseline) * c.child_profit_share
        top_up = max(0.0, c.min_bot_capital - from_parent)
        if top_up > self.pool:
            return  # not enough money for a viable child yet
        rng = random.Random("child-%s-%d" % (c.seed, self.next_id))
        genome = _mutate(IndicatorGenome(**agent.genome), rng)
        agent.cash -= from_parent
        self.pool -= top_up
        child = self._new_agent(agent.id, agent.generation + 1, agent.symbol, genome,
                                from_parent + top_up, t)
        agent.baseline = agent.cash
        agent.trips_since_reproduction = 0
        agent.children += 1
        births.append(child)
        self._log(t, "BIRTH", child, symbol=child.symbol, capital=round(child.cash, 4),
                  parent=agent.id, from_parent=round(from_parent, 4),
                  from_pool=round(top_up, 4))

    def step(self, t, day, views):
        """Advance one closed candle. `views` maps symbol -> View. Idempotent per t."""
        if self.last_t is not None and t <= self.last_t:
            return []
        c = self.config
        first_event = len(self.events)
        prices = {s: v.price for s, v in views.items()}
        known = {a.symbol for a in self.alive()} - set(prices)
        if known:
            raise ValueError("Missing market view for: " + ", ".join(sorted(known)))
        equity = self.equity(prices)
        if day != self.day:
            self.day = day
            self.start_of_day = equity
            self.history.append({"t": t, "day": day, "equity": round(equity, 4),
                                 "alive": len(self.alive())})
            del self.history[:-1000]
        previous_halt = self.halted
        if equity <= c.capital * (1 - c.colony_total_loss):
            self.halted = "COLONY_TOTAL_LOSS_LIMIT"
        elif equity <= self.start_of_day * (1 - c.colony_daily_loss):
            self.halted = "COLONY_DAILY_LOSS_LIMIT"
        else:
            self.halted = None
        if self.halted and self.halted != previous_halt:
            self._log(t, "HALT", reason=self.halted, equity=round(equity, 4))
        births = []
        exposure = self.exposure(prices)
        for agent in sorted(self.alive(), key=lambda a: int(a.id[1:])):
            view = views[agent.symbol]
            price = view.price
            if agent.equity(price, c.fee, c.slippage) <= agent.baseline * (1 - c.death_loss):
                self._kill(agent, "LOSS", price, t)
                continue
            if t - agent.last_activity >= c.max_idle_hours:
                self._kill(agent, "IDLE", price, t)
                continue
            g = IndicatorGenome(**agent.genome)
            profile = view.profile
            signal = view.signal(g.fast, g.slow)
            if agent.units:
                if (price <= agent.entry * (1 - g.stop) or price >= agent.entry * (1 + g.take)
                        or signal == "SELL" or profile["rsi"] < g.rsi_sell_min):
                    exposure -= agent.units * price * (1 - c.fee - c.slippage)
                    self._sell(agent, price, t, "EXIT")
            elif (signal == "BUY" and profile["rsi"] <= g.rsi_buy_max
                  and profile["atr_percent"] <= g.max_atr_percent
                  and profile["regime"] != "HIGH_VOLATILITY"):
                amount = min(agent.cash, equity * c.max_position_fraction)
                if self.halted:
                    self._log(t, "SKIP", agent, reason=self.halted)
                elif amount < MIN_ORDER_QUOTE:
                    self._log(t, "SKIP", agent, reason="BELOW_MIN_ORDER")
                elif exposure + amount > equity * c.max_total_exposure:
                    self._log(t, "SKIP", agent, reason="COLONY_EXPOSURE_LIMIT")
                else:
                    self._buy(agent, amount, price, t)
                    exposure += amount * (1 - c.fee)
            if agent.alive and not agent.units:
                self._maybe_reproduce(agent, t, births)
        self.agents.extend(births)
        self.last_t = t
        return self.events[first_event:]

    # --- reporting / persistence --------------------------------------------------
    def summary(self, prices):
        c = self.config
        ranked = sorted(self.agents, key=lambda a: a.id)
        bots = []
        for a in ranked:
            price = prices.get(a.symbol)
            eq = a.equity(price, c.fee, c.slippage) if (a.alive and price) else a.cash
            bots.append({"id": a.id, "parent": a.parent, "generation": a.generation,
                         "symbol": a.symbol, "alive": a.alive, "death_reason": a.death_reason,
                         "birth_capital": round(a.birth_capital, 4), "equity": round(eq, 4),
                         "round_trips": a.round_trips,
                         "winning_round_trips": a.winning_round_trips,
                         "children": a.children, "in_position": bool(a.units)})
        return {"mode": "PAPER_COLONY", "equity": round(self.equity(prices), 4),
                "initial_capital": c.capital, "pool": round(self.pool, 4),
                "alive": len(self.alive()), "births": self.births, "deaths": dict(self.deaths),
                "max_generation": max((a.generation for a in self.agents), default=0),
                "halted": self.halted, "bots": bots,
                "warning": "Simulacao. Lucro passado nao garante resultado futuro."}

    def to_dict(self):
        return {"schema": 1, "mode": "PAPER_COLONY", "config": asdict(self.config),
                "pool": self.pool, "agents": [asdict(a) for a in self.agents],
                "next_id": self.next_id, "last_t": self.last_t, "day": self.day,
                "start_of_day": self.start_of_day, "halted": self.halted,
                "events": self.events, "history": self.history,
                "births": self.births, "deaths": self.deaths}

    @classmethod
    def from_dict(cls, data):
        if data.get("schema") != 1 or data.get("mode") != "PAPER_COLONY":
            raise ValueError("Incompatible colony state")
        names = {f.name for f in fields(ColonyConfig)}
        colony = cls(ColonyConfig(**{k: v for k, v in data["config"].items() if k in names}))
        colony.pool = float(data["pool"])
        colony.agents = [Agent(**a) for a in data["agents"]]
        for key in ("next_id", "last_t", "day", "start_of_day", "halted",
                    "events", "history", "births", "deaths"):
            setattr(colony, key, data[key])
        if colony.pool < 0 or any(a.cash < 0 or a.units < 0 for a in colony.agents):
            raise ValueError("Invalid colony balances")
        return colony


def candle_day(candle, index):
    if candle.open_time is not None:
        return datetime.fromtimestamp(candle.open_time / 1000, timezone.utc).date().isoformat()
    return "d%d" % (index // 24)


def views_at(features, i):
    """Market views for step i: indicators of candles[:i], fill at candles[i] open."""
    return {s: View(f.profile(i), (lambda fast, slow, f=f: f.signal(i, fast, slow)),
                    f.exec_price[i]) for s, f in features.items()}


def run_backtest(data, config=ColonyConfig(), research_fraction=0.7, bots=12,
                 generations=5, ignore_approval=False):
    """Research on the first part of the history, then run the colony on the rest.

    The colony period is never seen by the research. `ignore_approval` seeds
    the colony even if research rejects the winner: for study only.
    """
    if not data:
        raise ValueError("No candles")
    lengths = {len(c) for c in data.values()}
    if len(lengths) != 1:
        raise ValueError("Aligned equal-length candle histories required")
    n = lengths.pop()
    cut = int(n * research_fraction)
    if cut < 180 or n - cut < 48:
        raise ValueError("Historico curto: precisa de >= 180 candles de pesquisa e 48 de colonia")
    research = evolve_indicators({s: c[:cut] for s, c in data.items()}, capital=config.capital,
                                 bots=bots, generations=generations, seed=config.seed)
    report = {"mode": "PAPER_COLONY_BACKTEST", "research_candles": cut,
              "colony_candles": n - cut, "research_approved": research["approved_for_paper"],
              "winner": research["winner"]}
    if not research["approved_for_paper"] and not ignore_approval:
        report["status"] = "REJECTED_RESEARCH"
        report["note"] = "Pesquisa nao aprovou estrategia; colonia nao foi criada."
        return report
    symbols = sorted(data)
    features = {s: Features(c) for s, c in data.items()}
    colony = Colony(config)
    colony.seed(seed_genomes(research["winner"], config.initial_bots, config.seed), symbols, cut)
    first = next(iter(data.values()))
    for i in range(cut, n):
        colony.step(i, candle_day(first[i], i), views_at(features, i))
    last = {s: c[-1].close for s, c in data.items()}
    start_prices = {s: features[s].exec_price[cut] for s in symbols}
    share = config.capital / len(symbols)
    buy_hold = sum(share * (1 - config.fee) / (start_prices[s] * (1 + config.slippage))
                   * last[s] * (1 - config.fee - config.slippage) for s in symbols)
    report.update(colony.summary(last))
    report.update({"status": "SIMULATED", "ignored_research_rejection":
                   ignore_approval and not research["approved_for_paper"],
                   "buy_hold_equity": round(buy_hold, 4), "equity_by_day": colony.history,
                   "recent_events": colony.events[-30:]})
    return report
