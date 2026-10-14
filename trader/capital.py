"""Shared quote balance coordinator for competing trading bots.

This module never submits exchange orders. The exchange is authoritative:
reconcile with its free/locked balances before enabling live execution.
"""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from threading import RLock
from uuid import uuid4


def amount(value):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("Invalid amount") from exc
    if not number.is_finite() or number < 0:
        raise ValueError("Amount must be finite and nonnegative")
    return number


@dataclass(frozen=True)
class Reservation:
    id: str
    bot_id: str
    amount: Decimal


class SharedCapital:
    """Single-process, thread-safe paper coordinator; no persistent live guarantees."""

    def __init__(self, free_balance, fee_reserve="0.01", max_order_fraction="0.25"):
        self._lock = RLock()
        self._free = amount(free_balance)
        self._reserved = {}
        self._spent = Decimal("0")
        self.fee_reserve = amount(fee_reserve)
        self.max_order_fraction = amount(max_order_fraction)
        if self.fee_reserve >= 1 or not 0 < self.max_order_fraction <= 1:
            raise ValueError("Invalid allocation policy")

    def snapshot(self):
        with self._lock:
            return {
                "free": str(self._free),
                "reserved": str(sum((r.amount for r in self._reserved.values()), Decimal(0))),
                "spent": str(self._spent),
                "available": str(self._available()),
                "reservations": len(self._reserved),
            }

    def _available(self):
        return max(Decimal(0), self._free * (1 - self.fee_reserve))

    def reserve(self, bot_id, requested=None):
        """Reserve up to requested amount, bounded by policy and current free balance.

        The cap is a fraction of currently free capital, not a fixed bot allocation.
        """
        if not isinstance(bot_id, str) or not bot_id.strip():
            raise ValueError("Bot id required")
        with self._lock:
            available = self._available()
            cap = available * self.max_order_fraction
            desired = cap if requested is None else amount(requested)
            budget = min(desired, cap)
            if budget <= 0:
                raise ValueError("Insufficient available balance")
            token = Reservation(uuid4().hex, bot_id, budget)
            self._free -= budget
            self._reserved[token.id] = token
            return token

    def cancel(self, reservation_id):
        with self._lock:
            token = self._reserved.pop(reservation_id)
            self._free += token.amount
            return token.amount

    def commit_buy(self, reservation_id, actual_spend):
        """Commit confirmed buy cost including fees; release unused reserve.

        Must only be called after an independently verified exchange fill.
        """
        spent = amount(actual_spend)
        with self._lock:
            token = self._reserved[reservation_id]
            if spent > token.amount:
                raise ValueError("Fill exceeds reservation")
            del self._reserved[reservation_id]
            self._free += token.amount - spent
            self._spent += spent
            return spent

    def credit_sell(self, confirmed_net_proceeds):
        """Credit only verified sale proceeds net of exchange fees."""
        proceeds = amount(confirmed_net_proceeds)
        with self._lock:
            self._free += proceeds
            return self._free

    def reconcile(self, exchange_free):
        """Forbid reconciliation while orders are reserved/in flight."""
        new_free = amount(exchange_free)
        with self._lock:
            if self._reserved:
                raise RuntimeError("Cannot reconcile with pending reservations")
            self._free = new_free
            return self._free
