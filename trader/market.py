import json
from urllib.request import Request, urlopen
from urllib.parse import urlencode

BASE = "https://api.binance.com/api/v3/"

class Market:
    def get(self, path, params=None):
        url = BASE + path + ("?" + urlencode(params) if params else "")
        req = Request(url, headers={"User-Agent": "CryptoEvolutionLab/1.0"})
        with urlopen(req, timeout=15) as response:
            return json.load(response)

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
