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
from urllib.error import HTTPError, URLError

TESTNET = 'https://testnet.binance.vision/api/v3/'

def dec(x):
    d = Decimal(str(x))
    if not d.is_finite():
        raise ValueError('Non-finite amount')
    return d


def format_quantity(x):
    """Plain decimal string accepted by Binance (never scientific notation)."""
    d = dec(x)
    if d <= 0:
        raise ValueError('Invalid quantity')
    text = format(d.normalize(), 'f')
    return text


# Common Binance error codes -> short actionable hint (Portuguese).
ERROR_HINTS = {
    -1021: 'relogio do computador fora de sincronia com a Binance',
    -1022: 'assinatura invalida: confira o API SECRET da Testnet',
    -2014: 'formato da API KEY invalido',
    -2015: 'API KEY invalida, sem permissao ou IP nao liberado (use chave da TESTNET, nao da conta real)',
    -1013: 'quantidade/valor fora dos filtros do par (LOT_SIZE, NOTIONAL)',
    -1100: 'parametro com caractere invalido',
    -1111: 'precisao da quantidade maior que a permitida pelo par',
    -2010: 'ordem rejeitada (saldo ficticio insuficiente ou regra do par)',
}


class BinanceAPIError(RuntimeError):
    """Exchange error with status and Binance code; never carries credentials."""
    def __init__(self, status, code=None, msg=None):
        self.status, self.code, self.msg = status, code, msg
        text = 'Binance Spot Testnet HTTP status %s' % status
        if code is not None:
            text += ' code %s' % code
        hint = ERROR_HINTS.get(code)
        if status == 451:
            hint = 'regiao bloqueada pela Binance para este IP (ex.: servidores nos EUA)'
        elif status in (418, 429):
            hint = 'limite de requisicoes excedido; aguarde antes de tentar de novo'
        if msg:
            text += ': ' + msg
        if hint:
            text += ' (' + hint + ')'
        super().__init__(text)


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
    ALLOWED_PATHS = ('ping', 'time', 'account', 'order/test', 'order')

    def __init__(self, key=None, secret=None, recv_window=5000):
        self.key = key if key is not None else os.environ.get('BINANCE_TESTNET_API_KEY','')
        self.secret = secret if secret is not None else os.environ.get('BINANCE_TESTNET_API_SECRET','')
        self.key, self.secret = self.key.strip(), self.secret.strip()
        if not self.key or not self.secret:
            raise ValueError('Testnet credentials missing')
        self.recv_window = int(recv_window)
        self.time_offset_ms = None  # server - local, measured lazily

    def _redact(self, text):
        text = str(text)[:300]
        for secret in (self.key, self.secret):
            if secret:
                text = text.replace(secret, '***')
        return text

    def _error(self, exc):
        code = msg = None
        try:
            body = json.loads(exc.read().decode('utf-8', 'replace') or '{}')
            if isinstance(body, dict):
                code = int(body['code']) if 'code' in body else None
                msg = self._redact(body.get('msg', '')) or None
        except Exception:
            pass
        return BinanceAPIError(exc.code, code, msg)

    def _send(self, req):
        try:
            with urlopen(req, timeout=15) as response:
                return json.load(response)
        except HTTPError as exc:
            # Never include the request URL, signed query or key.
            raise self._error(exc) from None
        except URLError:
            raise RuntimeError('Binance Spot Testnet inacessivel (rede, DNS ou firewall)') from None

    def sync_time(self):
        """Measure clock offset against the exchange; tolerant of bad replies."""
        before = int(time.time()*1000)
        data = self.request('time')
        after = int(time.time()*1000)
        server = data.get('serverTime') if isinstance(data, dict) else None
        self.time_offset_ms = (int(server) - (before + after)//2) if isinstance(server, (int, float)) else 0
        return self.time_offset_ms

    def request(self, path, params=None, method='GET', signed=False, _retry=True):
        if path not in self.ALLOWED_PATHS:
            raise ValueError('Testnet API path not allowed')
        if method not in ('GET', 'POST'):
            raise ValueError('Unsupported request method')
        params = dict(params or {})
        if signed:
            if self.time_offset_ms is None:
                try:
                    self.sync_time()
                except (RuntimeError, ValueError):
                    self.time_offset_ms = 0
            params['timestamp'] = int(time.time()*1000) + self.time_offset_ms
            params['recvWindow'] = self.recv_window
            query = urlencode(params)
            params['signature'] = hmac.new(self.secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        payload = urlencode(params)
        url = TESTNET + path + (('?' + payload) if method == 'GET' and payload else '')
        headers = {'User-Agent':'CryptoEvolutionLab/1.0'}
        if signed:
            headers['X-MBX-APIKEY'] = self.key
        if method != 'GET':
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
        req = Request(url, data=payload.encode() if method != 'GET' else None,
                      headers=headers, method=method)
        try:
            return self._send(req)
        except BinanceAPIError as exc:
            # -1021 is rejected before processing, so one resync + retry is safe.
            if signed and _retry and exc.code == -1021:
                self.sync_time()
                params.pop('signature', None)
                params.pop('timestamp', None)
                params.pop('recvWindow', None)
                return self.request(path, params, method, signed, _retry=False)
            raise

    def account(self):
        return self.request('account', signed=True)

    @staticmethod
    def _order_params(symbol, side, quantity):
        if side not in ('BUY','SELL') or not isinstance(symbol, str) or not symbol.endswith('USDT'):
            raise ValueError('Only USDT spot orders supported')
        return {'symbol':symbol.upper(),'side':side,'type':'MARKET',
                'quantity':format_quantity(quantity)}

    def test_order(self, symbol, side, quantity):
        # This endpoint validates an order but does not execute it.
        return self.request('order/test', self._order_params(symbol, side, quantity),
                            method='POST', signed=True)

    def place_testnet_order(self, symbol, side, quantity):
        """EXECUTES a fictitious MARKET order on Binance Spot Testnet ONLY.

        Caller must explicitly authorize the action. Uses testnet credentials.
        """
        params = self._order_params(symbol, side, quantity)
        params['newOrderRespType'] = 'FULL'
        return self.request('order', params, method='POST', signed=True)

    def order_status(self, symbol, order_id):
        if not symbol.endswith('USDT') or int(order_id) <= 0:
            raise ValueError('Invalid testnet order reference')
        return self.request('order', {'symbol':symbol,'orderId':int(order_id)},
                            signed=True)
