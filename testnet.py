"""Binance Spot Testnet CLI. No production endpoints or real-money orders."""
import argparse
import json
import sys
import time
from trader.execution import BinanceAPIError, BinanceSpotTestnet


def main():
    p=argparse.ArgumentParser(description="Binance Spot Testnet (fictitious funds)")
    p.add_argument("--account",action="store_true")
    p.add_argument("--test-order",action="store_true",
                   help="Validate an order without execution")
    p.add_argument("--execute",action="store_true",
                   help="Execute a fictitious order on TESTNET only")
    p.add_argument("--confirm-testnet",action="store_true",
                   help="Required explicit confirmation for --execute")
    p.add_argument("--symbol",default="BTCUSDT")
    p.add_argument("--side",choices=("BUY","SELL"),default="BUY")
    p.add_argument("--quantity",default="0.001")
    p.add_argument("--asset",nargs="+",help="Com --account: mostrar so estes ativos (ex.: BTC USDT)")
    a=p.parse_args()
    if not (a.account or a.test_order or a.execute):
        p.error("Choose --account, --test-order or --execute")
    if a.execute and (not a.confirm_testnet or a.test_order):
        p.error("--execute requires --confirm-testnet and cannot combine with --test-order")
    try:
        run(a)
    except (RuntimeError,ValueError) as exc:
        print("FALHA: "+str(exc),file=sys.stderr)
        raise SystemExit(1)


def run(a):
    api=BinanceSpotTestnet()
    if a.account:
        account=api.account()
        wanted={x.upper() for x in a.asset} if a.asset else None
        balances=[{"asset":x["asset"],"free":x["free"],"locked":x["locked"]}
                  for x in account.get("balances",[])
                  if (float(x["free"]) or float(x["locked"]))
                  and (wanted is None or x["asset"] in wanted)]
        print(json.dumps({"mode":"TESTNET","balances":balances},indent=2))
    if a.test_order:
        result=api.test_order(a.symbol,a.side,a.quantity)
        print(json.dumps({"mode":"TESTNET","validated":True,
                          "exchange_response":result},indent=2))
    if a.execute:
        client_id="cli-%s-%d" % (a.side[0], int(time.time()*1000))
        try:
            result=api.place_testnet_order(a.symbol,a.side,a.quantity,client_id=client_id)
        except RuntimeError as exc:
            if isinstance(exc,BinanceAPIError) and exc.status is not None and exc.status<500:
                raise  # rejected by the exchange: nothing was executed
            # Unknown outcome (timeout/5xx): look it up instead of resending.
            print("Resposta nao chegou (%s). Conferindo a ordem %s..." % (exc, client_id),
                  file=sys.stderr)
            result=api.order_by_client_id(a.symbol,client_id)
        # Print the execution first: a later status-check failure must not hide it.
        print(json.dumps({"mode":"TESTNET","executed":True,"order":result},indent=2),flush=True)
        order_id=result.get("orderId")
        if order_id:
            try:
                status=api.order_status(a.symbol,order_id)
                print(json.dumps({"confirmed_status":status.get("status"),
                                  "executedQty":status.get("executedQty")},indent=2))
            except RuntimeError as exc:
                print("Ordem executada, mas a confirmacao falhou: %s" % exc,file=sys.stderr)

if __name__=="__main__":
    main()
