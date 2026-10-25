"""Read-only Binance Spot Testnet connection check. Never sends orders."""
import json
import os
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
from trader.execution import BinanceSpotTestnet, TESTNET


def public_ping():
    try:
        with urlopen(TESTNET + "ping", timeout=15) as response:
            return json.load(response)
    except HTTPError as exc:
        if exc.code == 451:
            raise RuntimeError(
                "BINANCE_TESTNET_REGION_RESTRICTED: endpoint publico devolveu HTTP 451 "
                "ao runner GitHub; credenciais ainda nao foram verificadas. "
                "Nao repetir ordens nem usar VPN/proxy para contornar a restricao."
            ) from None
        raise RuntimeError("BINANCE_TESTNET_PUBLIC_HTTP_%s" % exc.code) from None
    except URLError:
        raise RuntimeError("BINANCE_TESTNET_NETWORK_UNREACHABLE") from None


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
