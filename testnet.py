"""Binance Spot Testnet CLI. No production endpoints or real-money orders."""
import argparse
import json
from trader.execution import BinanceSpotTestnet


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
    a=p.parse_args()
    if not (a.account or a.test_order or a.execute):
        p.error("Choose --account, --test-order or --execute")
    if a.execute and (not a.confirm_testnet or a.test_order):
        p.error("--execute requires --confirm-testnet and cannot combine with --test-order")
    api=BinanceSpotTestnet()
    if a.account:
        account=api.account()
        balances=[{"asset":x["asset"],"free":x["free"],"locked":x["locked"]}
                  for x in account.get("balances",[])
                  if float(x["free"]) or float(x["locked"])]
        print(json.dumps({"mode":"TESTNET","balances":balances},indent=2))
    if a.test_order:
        result=api.test_order(a.symbol,a.side,a.quantity)
        print(json.dumps({"mode":"TESTNET","validated":True,
                          "exchange_response":result},indent=2))
    if a.execute:
        result=api.place_testnet_order(a.symbol,a.side,a.quantity)
        order_id=result.get("orderId")
        status=api.order_status(a.symbol,order_id) if order_id else result
        print(json.dumps({"mode":"TESTNET","executed":True,
                          "order":result,"confirmed_status":status},indent=2))


if __name__=="__main__":
    main()
