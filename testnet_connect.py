"""Read-only Binance Spot Testnet connection check. Never sends orders."""
import json
import os
from urllib.request import urlopen
from trader.execution import BinanceSpotTestnet, TESTNET


def public_ping():
    with urlopen(TESTNET + "ping", timeout=15) as response:
        return json.load(response)


def safe_account_summary(account):
    balances = account.get("balances", [])
    nonzero = sum(1 for item in balances
                  if float(item.get("free", 0)) or float(item.get("locked", 0)))
    return {"mode": "SPOT_TESTNET", "authenticated": True,
            "nonzero_asset_count": nonzero,
            "can_trade": bool(account.get("canTrade", False)),
            "orders_sent": 0}


def main():
    public_ping()
    if not os.environ.get("BINANCE_TESTNET_API_KEY") or not os.environ.get("BINANCE_TESTNET_API_SECRET"):
        raise SystemExit("Testnet credentials not configured in GitHub Actions secrets")
    result = BinanceSpotTestnet().account()
    print(json.dumps(safe_account_summary(result), sort_keys=True))


if __name__ == "__main__":
    main()
