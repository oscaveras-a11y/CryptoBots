"""Execution boundary: paper portfolio and Binance Spot TESTNET only."""
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import urlencode
from urllib.request import Request, urlopen

TESTNET = 'https://testnet.binance.vision/api/v3/'

def dec(x):
    d = Decimal(str(x))
    if not d.is_finite():
        raise ValueError('Non-finite amount')
    return d

@dataclass(frozen=True)
class Limits:
    capital: Decimal = Decimal('100')
    max_allocation: Decimal = Decimal('0.10')
    daily_loss: Decimal = Decimal('0.03')
    total_loss: Decimal = Decimal('0.08')
    fee: Decimal = Decimal('0.001')
    slippage: Decimal = Decimal('0.0005')

    def __post_init__(self):
        if self.capital <= 0 or not (0 < self.max_allocation <= 1) or not (0 < self.daily_loss < 1) or not (0 < self.total_loss < 1):
            raise ValueError('Invalid risk limits')
        if self.fee < 0 or self.slippage < 0:
            raise ValueError('Invalid execution costs')

class PaperPortfolio:
    """Virtual quote-currency balance; no BRL conversion assumed."""
    def __init__(self, limits=Limits()):
        self.limits = limits
        self.cash = limits.capital
        self.holdings = {}
        self.start_of_day = limits.capital
        self.day = None
        self.trades = []

    def equity(self, prices):
        return self.cash + sum(q * dec(prices[s]) for s, q in self.holdings.items())

    def check(self, prices, day):
        equity = self.equity(prices)
        if self.day != day:
            self.day = day
            self.start_of_day = equity
        if equity <= self.limits.capital * (1-self.limits.total_loss):
            raise RuntimeError('TOTAL_LOSS_LIMIT')
        if equity <= self.start_of_day * (1-self.limits.daily_loss):
            raise RuntimeError('DAILY_LOSS_LIMIT')
        return equity

    def buy(self, symbol, price, prices, day):
        equity = self.check(prices, day)
        if symbol in self.holdings and self.holdings[symbol] > 0:
            raise ValueError('Existing position')
        budget = min(self.cash, equity * self.limits.max_allocation)
        if budget <= 0:
            raise ValueError('Insufficient cash')
        execution = dec(price) * (1+self.limits.slippage)
        qty = budget * (1-self.limits.fee) / execution
        self.cash -= budget
        self.holdings[symbol] = qty
        self.trades.append({'side':'BUY','symbol':symbol,'quantity':str(qty),'price':str(execution),'fee_quote':str(budget*self.limits.fee),'mode':'PAPER'})
        return qty

    def sell(self, symbol, price, prices, day):
        # Exits remain permitted after circuit breakers trigger.
        try:
            self.check(prices, day)
        except RuntimeError as exc:
            if str(exc) not in ('DAILY_LOSS_LIMIT', 'TOTAL_LOSS_LIMIT'):
                raise
        qty = self.holdings.get(symbol, Decimal(0))
        if qty <= 0:
            raise ValueError('No position')
        execution = dec(price) * (1-self.limits.slippage)
        gross = qty * execution
        self.cash += gross * (1-self.limits.fee)
        self.holdings[symbol] = Decimal(0)
        self.trades.append({'side':'SELL','symbol':symbol,'quantity':str(qty),'price':str(execution),'fee_quote':str(gross*self.limits.fee),'mode':'PAPER'})
        return gross

class BinanceSpotTestnet:
    """Only testnet API keys and testnet endpoints. No real orders."""
    def __init__(self, key=None, secret=None):
        self.key = key if key is not None else os.environ.get('BINANCE_TESTNET_API_KEY','')
        self.secret = secret if secret is not None else os.environ.get('BINANCE_TESTNET_API_SECRET','')
        if not self.key or not self.secret:
            raise ValueError('Testnet credentials missing')

    def request(self, path, params=None, method='GET', signed=False):
        params = dict(params or {})
        if signed:
            params['timestamp'] = int(time.time()*1000)
            params['recvWindow'] = 5000
            query = urlencode(params)
            params['signature'] = hmac.new(self.secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        payload = urlencode(params)
        url = TESTNET + path + (('?' + payload) if method == 'GET' and payload else '')
        req = Request(url, data=payload.encode() if method != 'GET' else None,
                      headers={'X-MBX-APIKEY':self.key,'User-Agent':'CryptoEvolutionLab/1.0'}, method=method)
        with urlopen(req, timeout=15) as response:
            return json.load(response)

    def account(self):
        return self.request('account', signed=True)

    def test_order(self, symbol, side, quantity):
        if side not in ('BUY','SELL') or not symbol.endswith('USDT'):
            raise ValueError('Only USDT spot orders supported')
        qty = dec(quantity)
        if qty <= 0:
            raise ValueError('Invalid quantity')
        # This endpoint validates an order but does not execute it.
        return self.request('order/test', {'symbol':symbol,'side':side,'type':'MARKET','quantity':str(qty)}, method='POST', signed=True)

    def place_testnet_order(self, symbol, side, quantity):
        """EXECUTES a fictitious MARKET order on Binance Spot Testnet ONLY.

        Caller must explicitly authorize the action. Uses testnet credentials.
        """
        if side not in ('BUY','SELL') or not symbol.endswith('USDT'):
            raise ValueError('Only USDT spot orders supported')
        qty = dec(quantity)
        if qty <= 0:
            raise ValueError('Invalid quantity')
        return self.request('order', {'symbol':symbol,'side':side,
                            'type':'MARKET','quantity':str(qty),
                            'newOrderRespType':'FULL'}, method='POST', signed=True)

    def order_status(self, symbol, order_id):
        if not symbol.endswith('USDT') or int(order_id) <= 0:
            raise ValueError('Invalid testnet order reference')
        return self.request('order', {'symbol':symbol,'orderId':int(order_id)},
                            signed=True)
