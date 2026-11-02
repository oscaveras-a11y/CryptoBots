import json
import time
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError

BASE = "https://api.binance.com/api/v3/"
# Official public market-data mirror (no trading, no keys). Used when the
# main host is region-blocked (HTTP 451/403) for this IP.
MIRROR = "https://data-api.binance.vision/api/v3/"
RETRY_STATUS = (418, 429, 500, 502, 503, 504)


class Market:
    def __init__(self, bases=(BASE, MIRROR), retries=3, backoff=2.0, sleep=time.sleep):
        self.bases = list(bases)
        self.retries = retries
        self.backoff = backoff
        self.sleep = sleep

    def _fetch(self, url):
        req = Request(url, headers={"User-Agent": "CryptoEvolutionLab/1.0"})
        with urlopen(req, timeout=15) as response:
            return json.load(response)

    def get(self, path, params=None):
        """Public read-only GET with retry/backoff and region-block fallback."""
        query = ("?" + urlencode(params)) if params else ""
        last_error = "sem resposta"
        for base in list(self.bases):
            for attempt in range(self.retries):
                try:
                    result = self._fetch(base + path + query)
                    if base != self.bases[0]:
                        # Region-blocked host goes last for later calls.
                        self.bases.remove(base)
                        self.bases.insert(0, base)
                    return result
                except HTTPError as exc:
                    if exc.code in (403, 451):
                        last_error = "HTTP %s (regiao bloqueada)" % exc.code
                        break  # try the next host
                    if exc.code in RETRY_STATUS and attempt + 1 < self.retries:
                        retry_after = exc.headers.get("Retry-After") if exc.headers else None
                        try:
                            wait = float(retry_after)
                        except (TypeError, ValueError):
                            wait = self.backoff * (2 ** attempt)
                        self.sleep(min(wait, 60))
                        continue
                    raise RuntimeError("Binance dados de mercado HTTP %s em %s" % (exc.code, path)) from None
                except (URLError, TimeoutError, ConnectionError):
                    last_error = "rede indisponivel"
                    if attempt + 1 < self.retries:
                        self.sleep(self.backoff * (2 ** attempt))
                        continue
                    break
        raise RuntimeError("Binance dados de mercado indisponiveis (%s) em %s" % (last_error, path))

    def select_symbols(self, limit=8):
        info = self.get("exchangeInfo")
        allowed = {s["symbol"] for s in info["symbols"]
                   if s.get("status") == "TRADING"
                   and s.get("quoteAsset") == "USDT"
                   and s.get("isSpotTradingAllowed", False)
                   and s.get("baseAsset") not in {"USDT", "USDC", "FDUSD", "TUSD", "DAI"}}
        tickers = self.get("ticker/24hr")
        liquid = sorted((t for t in tickers if t["symbol"] in allowed
                         and float(t.get("quoteVolume", 0)) >= 10000000),
                        key=lambda t: float(t["quoteVolume"]), reverse=True)
        symbols = [t["symbol"] for t in liquid[:limit]]
        if not symbols:
            raise RuntimeError("Nenhum par elegível encontrado")
        return symbols

    def closes(self, symbol, limit=350):
        candles = self.get("klines", {"symbol": symbol, "interval": "1h", "limit": limit})
        values = [float(c[4]) for c in candles]
        if len(values) < 100 or any(v <= 0 for v in values):
            raise RuntimeError("Histórico insuficiente ou inválido: " + symbol)
        return values

    def ohlcv(self, symbol, limit=350):
        """Completed hourly candles only; never train on unfinished current bar."""
        from time import time
        from trader.strategy import Candle
        rows = self.get("klines", {"symbol":symbol,"interval":"1h","limit":limit})
        now_ms = int(time()*1000)
        closed = [row for row in rows if int(row[6]) < now_ms]
        if len(closed) < 180:
            raise RuntimeError("Historico fechado insuficiente: "+symbol)
        candles = [Candle(float(r[4]),float(r[2]),float(r[3]),float(r[5]))
                   for r in closed]
        for c in candles:
            if c.low <= 0 or c.high < c.low or not c.low <= c.close <= c.high or c.volume < 0:
                raise RuntimeError("Candle invalido: "+symbol)
        return candles
