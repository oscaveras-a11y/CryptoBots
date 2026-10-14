"""Binance Spot Testnet CLI: never places an actual order."""
import argparse
import json
from trader.execution import BinanceSpotTestnet

def main():
    p = argparse.ArgumentParser(description='Binance Spot Testnet - sem ordens reais')
    p.add_argument('--account', action='store_true', help='Consultar saldo fictício')
    p.add_argument('--test-order', action='store_true', help='Validar ordem sem executá-la')
    p.add_argument('--symbol', default='BTCUSDT')
    p.add_argument('--side', choices=['BUY','SELL'], default='BUY')
    p.add_argument('--quantity', default='0.001')
    a = p.parse_args()
    if not (a.account or a.test_order):
        p.error('Escolha --account ou --test-order')
    api = BinanceSpotTestnet()
    if a.account:
        result = api.account()
        balances = [{'asset':x['asset'],'free':x['free'],'locked':x['locked']}
                    for x in result.get('balances',[]) if float(x['free']) or float(x['locked'])]
        print(json.dumps({'mode':'TESTNET','balances':balances},indent=2))
    if a.test_order:
        result = api.test_order(a.symbol,a.side,a.quantity)
        print(json.dumps({'mode':'TESTNET','validated':True,'exchange_response':result},indent=2))

if __name__ == '__main__':
    main()
