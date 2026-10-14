"""Registro fiscal auditável para operações simuladas ou importadas.

Não calcula DARF automaticamente: classificação tributária exige jurisdição,
tipo de ativo, regime aplicável e revisão da legislação vigente.
"""
import csv
import sqlite3
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS trades (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 external_id TEXT NOT NULL,
 exchange TEXT NOT NULL,
 exchange_country TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 asset TEXT NOT NULL,
 side TEXT NOT NULL CHECK(side IN ('BUY','SELL','SWAP_IN','SWAP_OUT')),
 quantity TEXT NOT NULL,
 unit_price_brl TEXT NOT NULL,
 fee_brl TEXT NOT NULL,
 simulated INTEGER NOT NULL CHECK(simulated IN (0,1)),
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 UNIQUE(exchange, external_id)
);
"""

def money(value, allow_zero=True):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Valor monetário inválido") from exc
    if not amount.is_finite() or amount < 0 or (not allow_zero and amount == 0):
        raise ValueError("Valor deve ser positivo e finito")
    return amount

class FiscalLedger:
    def __init__(self, path="data/fiscal.sqlite3"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(self.path))
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript(SCHEMA)

    def close(self):
        self.db.close()

    def record(self, *, external_id, exchange, exchange_country, occurred_at,
               asset, side, quantity, unit_price_brl, fee_brl=0,
               simulated=True, notes=""):
        if side not in ("BUY", "SELL", "SWAP_IN", "SWAP_OUT"):
            raise ValueError("Tipo de operação inválido")
        if not all((external_id, exchange, exchange_country, asset)):
            raise ValueError("Identificadores obrigatórios")
        instant = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
        if instant.tzinfo is None:
            raise ValueError("Data deve conter fuso horário")
        qty = money(quantity, allow_zero=False)
        price = money(unit_price_brl, allow_zero=False)
        fee = money(fee_brl)
        with self.db:
            self.db.execute(
                """INSERT INTO trades
                (external_id,exchange,exchange_country,occurred_at,asset,side,
                 quantity,unit_price_brl,fee_brl,simulated,notes,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (str(external_id),exchange,exchange_country,
                 instant.astimezone(timezone.utc).isoformat(),asset,side,
                 str(qty),str(price),str(fee),int(bool(simulated)),notes,
                 datetime.now(timezone.utc).isoformat()))
        return True

    def monthly_rows(self, year, month, simulated=None):
        prefix = f"{int(year):04d}-{int(month):02d}-"
        query = "SELECT external_id,exchange,exchange_country,occurred_at,asset,side,quantity,unit_price_brl,fee_brl,simulated,notes FROM trades WHERE occurred_at LIKE ?"
        args = [prefix + "%"]
        if simulated is not None:
            query += " AND simulated=?"
            args.append(int(simulated))
        query += " ORDER BY occurred_at,id"
        return self.db.execute(query,args).fetchall()

    def export_csv(self, year, month, destination, simulated=None):
        columns = ("external_id","exchange","exchange_country","occurred_at",
                   "asset","side","quantity","unit_price_brl","fee_brl",
                   "simulated","notes")
        path = Path(destination)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w",newline="",encoding="utf-8-sig") as handle:
            writer = csv.writer(handle)
            writer.writerow(columns)
            writer.writerows(self.monthly_rows(year,month,simulated))
        return path
