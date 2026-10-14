import random
from dataclasses import dataclass, replace

@dataclass(frozen=True)
class Genome:
    fast: int
    slow: int
    stop: float
    take: float

def random_genome(rng):
    fast = rng.randint(4, 20)
    return Genome(fast, rng.randint(fast + 5, 65),
                  rng.uniform(.008, .04), rng.uniform(.012, .08))

def mutate(g, rng):
    fast = max(3, min(25, g.fast + rng.randint(-3, 3)))
    slow = max(fast + 3, min(75, g.slow + rng.randint(-5, 5)))
    return Genome(fast, slow, max(.005, min(.06, g.stop * rng.uniform(.8, 1.2))),
                  max(.008, min(.12, g.take * rng.uniform(.8, 1.2))))

def simulate(prices, genome, capital=100.0, fee=.001, slip=.0005, max_loss=.08):
    if capital <= 0 or len(prices) < genome.slow + 3:
        raise ValueError("Capital ou histórico insuficiente")
    cash, units, entry, trades = capital, 0.0, 0.0, 0
    peak, worst = capital, 0.0
    for i in range(genome.slow, len(prices)):
        price = prices[i]
        prev_fast = sum(prices[i-genome.fast:i]) / genome.fast
        prev_slow = sum(prices[i-genome.slow:i]) / genome.slow
        equity = cash + units * price * (1-fee-slip)
        peak = max(peak, equity)
        worst = max(worst, 1 - equity/peak)
        if equity <= capital * (1-max_loss):
            if units:
                cash = units * price * (1-fee-slip)
                units = 0.0
            return {"equity": round(cash, 4), "trades": trades, "drawdown": round(worst, 4), "dead": True}
        if units and (price <= entry*(1-genome.stop) or
                      price >= entry*(1+genome.take) or prev_fast < prev_slow):
            cash = units * price * (1-fee-slip)
            units = 0.0
            trades += 1
        elif not units and prev_fast > prev_slow:
            entry = price * (1+slip)
            units = cash * (1-fee) / entry
            cash = 0.0
    if units:
        cash = units * prices[-1] * (1-fee-slip)
        trades += 1
    return {"equity": round(cash, 4), "trades": trades, "drawdown": round(worst, 4),
            "dead": cash <= capital*(1-max_loss)}

def evolve(data, capital, bots=20, generations=8, seed=42):
    if not data:
        raise ValueError("Sem dados")
    rng = random.Random(seed)
    split = {symbol: int(len(prices)*.7) for symbol, prices in data.items()}
    population = [random_genome(rng) for _ in range(bots)]
    history = []
    for generation in range(generations):
        scores = []
        for genome in population:
            results = [simulate(prices[:split[s]], genome, capital)
                       for s, prices in data.items()]
            avg = sum(r["equity"] for r in results)/len(results)
            penalty = sum(r["drawdown"] for r in results)/len(results)
            deaths = sum(r["dead"] for r in results)
            scores.append((avg - capital*penalty - deaths*capital*.1, genome))
        scores.sort(key=lambda x: x[0], reverse=True)
        champions = [g for _, g in scores[:max(2, bots//4)]]
        history.append({"generation": generation+1, "best_train_score": round(scores[0][0], 4)})
        population = champions + [mutate(rng.choice(champions), rng) for _ in range(bots-len(champions))]
    # Select final candidate on training only; validation never influences evolution.
    finalists = sorted(population, key=lambda g: sum(simulate(p[:split[s]], g, capital)["equity"]
                         for s,p in data.items()), reverse=True)
    winner = finalists[0]
    validation = {}
    for symbol, prices in data.items():
        # Warm-up candles are included, but only the tail is traded by simulate.
        tail = prices[max(0, split[symbol]-winner.slow):]
        validation[symbol] = simulate(tail, winner, capital)
    return {"mode": "PAPER_ONLY", "initial_capital_virtual": capital,
            "symbols": list(data), "generations": history,
            "winner": vars(winner), "out_of_sample": validation,
            "warning": "Simulação não garante lucro. Sem ordens reais."}
