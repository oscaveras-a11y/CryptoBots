"""Read-only local status report for autonomous PAPER agents.

Never sends orders or accesses credentials. Status is a point-in-time snapshot.
"""
import argparse
import json
from decimal import Decimal
from pathlib import Path


def report(path):
    state=json.loads(Path(path).read_text(encoding="utf-8"))
    if state.get("schema")!=1 or state.get("mode") not in ("PAPER_ONLY","TESTNET"):
        raise ValueError("Unsupported or unsafe portfolio state")
    cash=Decimal(state["cash"])
    if not cash.is_finite() or cash<0:
        raise ValueError("Invalid cash")
    positions=[]
    for symbol,quantity in sorted(state["holdings"].items()):
        qty=Decimal(quantity)
        if not qty.is_finite() or qty<0:
            raise ValueError("Invalid holding")
        if qty:
            positions.append({
                "agent":state.get("position_owners",{}).get(symbol,"unassigned"),
                "symbol":symbol,"quantity":str(qty),
                "entry_price":state.get("entries",{}).get(symbol)
            })
    trades=state.get("trades",[])
    return {"mode":state["mode"],"cycle":state["cycle_number"],
            "pending_testnet_order":state.get("pending_order"),
            "free_quote_balance":str(cash),
            "open_positions":positions,
            "completed_trade_events":len(trades),
            "recent_trades":trades[-10:],
            "strategy_approved":state["approved"],
            "warning":"Virtual/testnet balance only; no real money and no live PnL."}


def main():
    parser=argparse.ArgumentParser(description="Local CryptoBots paper dashboard data")
    parser.add_argument("--state",default="data/paper-state.json")
    args=parser.parse_args()
    print(json.dumps(report(args.state),indent=2,ensure_ascii=False))


if __name__=="__main__":
    main()
