"""Evolution of indicator-based spot strategies, strictly offline.

Train on the first 70% of CLOSED candles; the holdout (last 30%) is evaluated
only after selection, plus a walk-forward split of the holdout into windows.

Fill model (same rule as the live paper bot): the decision at step i uses only
candles[:i] (all closed), and the order fills at the OPEN of candle i, which is
the price available right after candle i-1 closes. Candles without an open
price fall back to the previous close. No real orders, no guaranteed returns.
"""
import random
from dataclasses import asdict, dataclass
from math import isfinite
from statistics import mean


@dataclass(frozen=True)
class IndicatorGenome:
    fast: int
    slow: int
    rsi_buy_max: int
    rsi_sell_min: int
    max_atr_percent: float
    stop: float
    take: float


# Approval policy (see evolve_indicators).
MIN_HOLDOUT_ROUND_TRIPS = 3
WALK_FORWARD_WINDOWS = 4
MIN_GOOD_WINDOWS = 3

# trading_signal defaults, mirrored by Features.signal.
_VOLUME_WINDOW = 20
_MAX_SIGNAL_VOLATILITY = 0.06
_MIN_VOLUME_RATIO = 0.75


def _random(rng):
    fast = rng.randint(4, 18)
    return IndicatorGenome(fast, rng.randint(fast+5, 45),
                           rng.randint(55, 75), rng.randint(25, 45),
                           rng.uniform(2, 7), rng.uniform(.01, .04),
                           rng.uniform(.015, .08))


def _mutate(g, rng):
    fast = max(3, min(20, g.fast+rng.randint(-2, 2)))
    return IndicatorGenome(fast, max(fast+4,min(50,g.slow+rng.randint(-4,4))),
                           max(45,min(80,g.rsi_buy_max+rng.randint(-4,4))),
                           max(20,min(55,g.rsi_sell_min+rng.randint(-4,4))),
                           max(1,min(9,g.max_atr_percent*rng.uniform(.9,1.1))),
                           max(.005,min(.06,g.stop*rng.uniform(.9,1.1))),
                           max(.008,min(.12,g.take*rng.uniform(.9,1.1))))


class Features:
    """Indicators for every prefix candles[:k], computed once.

    Values are bit-for-bit those of knowledge.market_profile(candles[:k]) and
    strategy.trading_signal(candles[:k], fast, slow): the same arithmetic in the
    same order, just reused instead of recomputed for every candle.
    """

    def __init__(self, candles):
        for c in candles:
            values = (c.close, c.high, c.low, c.volume)
            if (not all(isfinite(v) for v in values) or c.close <= 0 or c.low <= 0
                    or c.high < c.low or not c.low <= c.close <= c.high or c.volume < 0):
                raise ValueError("Invalid OHLCV candle")
            if c.open is not None and (not isfinite(c.open) or not c.low <= c.open <= c.high):
                raise ValueError("Invalid open price")
        self.n = n = len(candles)
        self.closes = closes = [c.close for c in candles]
        self.volumes = volumes = [c.volume for c in candles]
        self.candles = candles
        # Execution price at step i: open of candle i (fallback: close of i-1).
        self.exec_price = [None] + [candles[i].open if candles[i].open is not None
                                    else closes[i-1] for i in range(1, n)]
        self._sma = {}
        self._profiles = self._profile_series(candles)
        self._signal_base = self._signal_series(candles)

    # --- market_profile(candles[:k]) for k >= 51 ---------------------------
    def _ema_series(self, period):
        out = [None]*(self.n+1)
        if self.n < period:
            return out
        value = mean(self.closes[:period])
        out[period] = value
        for k in range(period, self.n):
            value += 2*(self.closes[k]-value)/(period+1)
            out[k+1] = value
        return out

    def _rsi_series(self, period=14):
        out = [None]*(self.n+1)
        closes = self.closes
        changes = [b-a for a, b in zip(closes[:-1], closes[1:])]
        if len(changes) < period:
            return out
        gain = mean([max(0, x) for x in changes[:period]])
        loss = mean([max(0, -x) for x in changes[:period]])

        def value(g, l):
            if l == 0:
                return 100.0 if g else 50.0
            return 100-100/(1+g/l)

        out[period+1] = value(gain, loss)
        for j in range(period, len(changes)):
            change = changes[j]
            gain = (gain*(period-1)+max(0, change))/period
            loss = (loss*(period-1)+max(0, -change))/period
            out[j+2] = value(gain, loss)
        return out

    def _atr_series(self, candles, period=14):
        out = [None]*(self.n+1)
        ranges = [max(c.high-c.low, abs(c.high-p.close), abs(c.low-p.close))
                  for p, c in zip(candles[:-1], candles[1:])]
        if len(ranges) < period:
            return out
        value = mean(ranges[:period])
        out[period+1] = value
        for j in range(period, len(ranges)):
            value = (value*(period-1)+ranges[j])/period
            out[j+2] = value
        return out

    def _profile_series(self, candles):
        profiles = [None]*(self.n+1)
        e12, e26, e50 = (self._ema_series(p) for p in (12, 26, 50))
        rsi, atr = self._rsi_series(), self._atr_series(candles)
        for k in range(51, self.n+1):
            volatility = atr[k]/self.closes[k-1]
            avg_volume = mean(self.volumes[k-21:k-1])
            ratio = self.volumes[k-1]/avg_volume if avg_volume else 0
            fast, slow, long = e12[k], e26[k], e50[k]
            if volatility > .055:
                regime = "HIGH_VOLATILITY"
            elif fast > slow > long:
                regime = "UPTREND"
            elif fast < slow < long:
                regime = "DOWNTREND"
            else:
                regime = "RANGE_OR_TRANSITION"
            profiles[k] = {"regime":regime, "rsi":round(rsi[k], 3),
                           "atr_percent":round(volatility*100, 3),
                           "volume_ratio":round(ratio, 3)}
        return profiles

    def profile(self, k):
        if k < 51:
            raise ValueError("At least 51 completed candles required")
        return self._profiles[k]

    # --- trading_signal(candles[:k], fast, slow) ---------------------------
    def _signal_series(self, candles):
        base = [None]*(self.n+1)
        w = _VOLUME_WINDOW
        for k in range(w+1, self.n+1):
            average_volume = sum(self.volumes[k-w-1:k-1])/w
            volume_ratio = self.volumes[k-1]/average_volume if average_volume else 0
            ranges = [c.high-c.low for c in candles[max(0, k-14):k]]
            volatility = (sum(ranges)/len(ranges))/self.closes[k-1]
            base[k] = (volume_ratio, volatility)
        return base

    def _sma_series(self, period):
        series = self._sma.get(period)
        if series is None:
            closes = self.closes
            series = [None]*(self.n+1)
            for k in range(period, self.n+1):
                series[k] = sum(closes[k-period:k])/period
            self._sma[period] = series
        return series

    def signal(self, k, fast, slow):
        if not 2 <= fast < slow:
            raise ValueError("Invalid lookback windows")
        if k < max(slow+1, _VOLUME_WINDOW+1, 16):
            return "WAIT"
        volume_ratio, volatility = self._signal_base[k]
        if volatility > _MAX_SIGNAL_VOLATILITY:
            return "WAIT"
        fs, ss = self._sma_series(fast), self._sma_series(slow)
        short, long, previous_short, previous_long = fs[k], ss[k], fs[k-1], ss[k-1]
        if short < long and previous_short >= previous_long:
            return "SELL"
        if short > long and previous_short <= previous_long:
            return "BUY" if volume_ratio >= _MIN_VOLUME_RATIO else "WAIT"
        return "WAIT"


def _replay(features, genome, capital, start, end, fee, slippage, max_loss):
    start = max(51, genome.slow+2) if start is None else max(start, 51, genome.slow+2)
    end = features.n if end is None else end
    cash, units, entry, trades, round_trips, wins = float(capital), 0.0, 0.0, 0, 0, 0
    peak, drawdown, stopped = float(capital), 0.0, False
    cost_basis = 0.0
    for i in range(start, end):
        price = features.exec_price[i]
        equity = cash+units*price*(1-fee-slippage)
        peak = max(peak, equity)
        drawdown = max(drawdown, 1-equity/peak)
        if equity <= capital*(1-max_loss):
            stopped = True
            if units:
                cash = units*price*(1-fee-slippage)
                units = 0
                trades += 1
                round_trips += 1
            break
        profile = features.profile(i)
        signal = features.signal(i, genome.fast, genome.slow)
        if units and (price <= entry*(1-genome.stop) or
                      price >= entry*(1+genome.take) or
                      signal == "SELL" or
                      profile["rsi"] < genome.rsi_sell_min):
            cash = units*price*(1-fee-slippage)
            units = 0
            trades += 1
            round_trips += 1
            wins += int(cash > cost_basis)
        elif (not units and signal == "BUY"
              and profile["rsi"] <= genome.rsi_buy_max
              and profile["atr_percent"] <= genome.max_atr_percent
              and profile["regime"] != "HIGH_VOLATILITY"):
            cost_basis = cash
            entry = price*(1+slippage)
            units = cash*(1-fee)/entry
            cash = 0.0
            trades += 1
    last_close = features.closes[end-1]
    final = cash+units*last_close*(1-fee-slippage)
    # Benchmark: buy at the first fill price of the period and hold to the end.
    first = features.exec_price[start] if start < end else last_close
    buy_hold = capital*(1-fee)/(first*(1+slippage))*last_close*(1-fee-slippage)
    return {"equity":round(final, 4), "trades":trades, "round_trips":round_trips,
            "winning_round_trips":wins, "drawdown":round(drawdown, 5),
            "dead":stopped, "buy_hold_equity":round(buy_hold, 4)}


def replay(candles, genome, capital=100.0, start=None,
           fee=.001, slippage=.0005, max_loss=.08, features=None, end=None):
    """Backtest one genome. `features` may be shared across calls on the same
    candles; `end` limits the replay to candles[:end] without slicing."""
    if capital <= 0 or len(candles) < 60:
        raise ValueError("Insufficient data or capital")
    features = Features(candles) if features is None else features
    return _replay(features, genome, capital, start, end, fee, slippage, max_loss)


def evolve_indicators(data, capital=100.0, bots=20, generations=8, seed=42,
                      min_round_trips=MIN_HOLDOUT_ROUND_TRIPS):
    if not data or bots < 2 or generations < 1:
        raise ValueError("Invalid research configuration")
    for candles in data.values():
        if len(candles) < 180:
            raise ValueError("At least 180 completed candles required")
    rng = random.Random(seed)
    splits = {s:int(len(c)*.7) for s, c in data.items()}
    features = {s:Features(c) for s, c in data.items()}
    population = [_random(rng) for _ in range(bots)]
    history = []
    best_seen = None
    cache = {}

    def score(g):
        if g not in cache:
            results = [replay(c, g, capital, features=features[s], end=splits[s])
                       for s, c in data.items()]
            cache[g] = sum(r["equity"]-capital*r["drawdown"]
                           - capital*.1*int(r["dead"]) for r in results)/len(results)
        return cache[g]

    for generation in range(generations):
        ranked = sorted(((score(g), g) for g in population),
                        key=lambda item:item[0], reverse=True)
        if best_seen is None or ranked[0][0] > best_seen[0]:
            best_seen = ranked[0]
        history.append({"generation":generation+1,
                        "best_train_score":round(ranked[0][0], 4)})
        champions = [g for _, g in ranked[:max(1, bots//4)]]
        population = champions+[_mutate(rng.choice(champions), rng)
                                for _ in range(bots-len(champions))]
    # The final mutated population is not itself evaluated by the loop.
    # Compare it against the best evaluated genome to avoid losing the elite.
    final_best = max(((score(g), g) for g in population), key=lambda item:item[0])
    winner = max((best_seen, final_best), key=lambda item:item[0])[1]
    validation = {s:replay(c, winner, capital, start=splits[s], features=features[s])
                  for s, c in data.items()}
    # Frozen-genome walk-forward on consecutive slices of the unseen data;
    # each window has its own simulated starting capital.
    walk_forward = {}
    for symbol, candles in data.items():
        first = splits[symbol]
        remaining = len(candles)-first
        boundaries = [first+(remaining*i)//WALK_FORWARD_WINDOWS
                      for i in range(WALK_FORWARD_WINDOWS+1)]
        windows = []
        for i in range(WALK_FORWARD_WINDOWS):
            start, end = boundaries[i], boundaries[i+1]
            result = replay(candles, winner, capital, start=start,
                            features=features[symbol], end=end)
            windows.append({"start_index":start, "end_index_exclusive":end, **result})
        walk_forward[symbol] = windows
    approved = all(r["round_trips"] >= min_round_trips and not r["dead"] and
                   r["equity"] >= capital for r in validation.values()) and all(
                   sum(w["round_trips"] > 0 for w in windows) >= MIN_GOOD_WINDOWS and
                   all(not w["dead"] for w in windows) and
                   sum(w["equity"] >= capital for w in windows) >= MIN_GOOD_WINDOWS
                   for windows in walk_forward.values())
    return {"mode":"PAPER_ONLY", "winner":asdict(winner),
            "generations":history, "out_of_sample":validation,
            "walk_forward":walk_forward,
            "approved_for_paper":approved,
            "approval_rule":("Holdout por moeda: >= %d operacoes completas, sem stop de "
                             "risco, sem prejuizo. Walk-forward: %d janelas, >= %d com "
                             "operacao e >= %d sem prejuizo, nenhuma com stop de risco. "
                             "buy_hold_equity e so comparacao.")
                            % (min_round_trips, WALK_FORWARD_WINDOWS,
                               MIN_GOOD_WINDOWS, MIN_GOOD_WINDOWS),
            "history_candles":{s:len(c) for s, c in data.items()},
            "warning":"Indicator evolution is experimental. Holdout is not live evidence."}
