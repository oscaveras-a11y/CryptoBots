"""Durable observational memory for PAPER research only.

SQLite tracks market snapshots, decisions and later price outcomes.
Outcomes are descriptive, not causal explanations or proof of profitability.
"""
import json
import sqlite3
from pathlib import Path


class MarketMemory:
    def __init__(self, path="data/market-memory.sqlite3"):
        self.path=Path(path)
        self.path.parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(str(self.path),timeout=20)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA busy_timeout=20000")
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS observations(
            symbol TEXT NOT NULL, candle_id TEXT NOT NULL,
            price REAL NOT NULL CHECK(price>0),
            change_24h REAL NOT NULL, direction TEXT NOT NULL,
            volume_ratio REAL, context_json TEXT NOT NULL,
            PRIMARY KEY(symbol,candle_id));
        CREATE TABLE IF NOT EXISTS decisions(
            symbol TEXT NOT NULL, candle_id TEXT NOT NULL,
            bot_id TEXT NOT NULL, action TEXT NOT NULL,
            reason TEXT NOT NULL, price REAL NOT NULL CHECK(price>0),
            details_json TEXT NOT NULL,
            outcome_24h_pct REAL,
            PRIMARY KEY(symbol,candle_id));
        """)
        self.db.commit()

    def observe(self,symbol,candle_id,observation,price):
        with self.db:
            self.db.execute("""
            INSERT OR IGNORE INTO observations
            (symbol,candle_id,price,change_24h,direction,volume_ratio,context_json)
            VALUES(?,?,?,?,?,?,?)""",
            (symbol,candle_id,price,observation["closed_candle_change_24h_pct"],
             observation["direction"],observation["last_hour_volume_vs_previous_24h"],
             json.dumps(observation,ensure_ascii=False,allow_nan=False)))

    def decide(self,symbol,candle_id,action,reason,price,details=None):
        with self.db:
            self.db.execute("""
            INSERT OR IGNORE INTO decisions
            (symbol,candle_id,bot_id,action,reason,price,details_json)
            VALUES(?,?,?,?,?,?,?)""",
            (symbol,candle_id,"strategy:"+symbol,action,reason,price,
             json.dumps(details or {},ensure_ascii=False,allow_nan=False)))

    def settle_prior(self,symbol,horizon=24):
        """Evaluate against the 24th subsequently observed distinct closed bar.

        Only consecutive observations produce an hourly interpretation; gaps
        mean this is a 24-observation outcome, not necessarily 24 clock hours.
        """
        rows=self.db.execute("""
            SELECT candle_id,price FROM observations
            WHERE symbol=? ORDER BY rowid""",(symbol,)).fetchall()
        if len(rows)<=horizon:
            return
        with self.db:
            for i in range(len(rows)-horizon):
                candle_id,entry_price=rows[i]
                exit_price=rows[i+horizon][1]
                self.db.execute("""
                    UPDATE decisions SET outcome_24h_pct=?
                    WHERE symbol=? AND candle_id=? AND outcome_24h_pct IS NULL""",
                    (round((exit_price/entry_price-1)*100,5),symbol,candle_id))

    def summary(self,limit=20):
        rows=self.db.execute("""
            SELECT symbol,direction,change_24h,volume_ratio
            FROM observations WHERE rowid IN
            (SELECT MAX(rowid) FROM observations GROUP BY symbol)
            ORDER BY ABS(change_24h) DESC LIMIT ?""",(limit,)).fetchall()
        decisions=self.db.execute("""
            SELECT action,COUNT(*),AVG(outcome_24h_pct)
            FROM decisions GROUP BY action""").fetchall()
        return {"markets":[{"symbol":s,"direction":d,"change_24h_pct":c,
                            "relative_volume":v} for s,d,c,v in rows],
                "decisions":[{"action":a,"count":n,
                              "avg_observed_24_observation_change_pct":avg}
                             for a,n,avg in decisions],
                "warning":"24 observations may span more than 24 hours; movement is not realized PnL."}

    def close(self):
        self.db.close()
