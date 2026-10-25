"""Read-only Binance Spot Testnet connection check. Never sends orders."""
import json
import os
import sys
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


def safe_account_summary(account, clock_offset_ms=None):
    balances = account.get("balances", [])
    nonzero = sum(1 for item in balances
                  if float(item.get("free", 0)) or float(item.get("locked", 0)))
    summary = {"mode": "SPOT_TESTNET", "authenticated": True,
               "nonzero_asset_count": nonzero,
               "can_trade": bool(account.get("canTrade", False)),
               "orders_sent": 0}
    if clock_offset_ms is not None:
        summary["clock_offset_ms"] = clock_offset_ms
    return summary


def report_failure(message):
    """Print the reason; on GitHub Actions also as an annotation visible in the run summary."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        clean = str(message).replace("%", "%25").replace("\r", "").replace("\n", " ")
        print("::error title=Binance Testnet::" + clean)
    print("FALHA: " + str(message), file=sys.stderr)


def main():
    try:
        public_ping()
        if not os.environ.get("BINANCE_TESTNET_API_KEY") or not os.environ.get("BINANCE_TESTNET_API_SECRET"):
            raise RuntimeError("Credenciais da Testnet nao configuradas (BINANCE_TESTNET_API_KEY / BINANCE_TESTNET_API_SECRET)")
        api = BinanceSpotTestnet()
        offset = api.sync_time()
        result = api.account()
    except (RuntimeError, ValueError) as exc:
        report_failure(exc)
        raise SystemExit(1)
    print(json.dumps(safe_account_summary(result, offset), sort_keys=True))


if __name__ == "__main__":
    main()
