"""Order execution for the autonomous bot: local PAPER simulation or Binance
Spot TESTNET (fictitious funds). There is no production endpoint anywhere.

Testnet rules:
- exchange filters (min size, step, notional) are checked before sending;
- every order has a deterministic client id; an uncertain result (timeout,
  HTTP 5xx) is LOOKED UP by that id, never resent;
- the local portfolio changes only after the exchange confirms a fill, using
  the executed quantity, quote amount and commissions it reports;
- a "pending order" marker is saved before sending, so a crash between sending
  and booking is resolved on the next cycle instead of being lost or doubled;
- before every cycle the local positions are compared with testnet balances.
"""
from decimal import Decimal, ROUND_DOWN

from trader.execution import BinanceAPIError, dec
from trader.strategy import eligible_market_order

QUOTE = "USDT"
CENT = Decimal("0.01")
LOSS_LIMITS = ("DAILY_LOSS_LIMIT", "TOTAL_LOSS_LIMIT")


def floor_to(value, step):
    value, step = dec(value), dec(step)
    if step <= 0:
        return value
    return (value / step).to_integral_value(rounding=ROUND_DOWN) * step


def client_order_id(side, symbol, candle_id):
    """Deterministic id per (side, symbol, candle): at most 36 safe characters."""
    text = "cb-%s-%s-%s" % (side[0], symbol, candle_id)
    if len(text) > 36:
        raise ValueError("Client order id too long")
    return text


class PaperBroker:
    """Local simulation (the existing PaperPortfolio fill model)."""
    mode = "PAPER"

    def __init__(self, portfolio):
        self.portfolio = portfolio

    def reconcile(self):
        return None

    def resolve_pending(self, pending):
        return None

    def buy(self, symbol, reference_price, prices, day, client_id, on_pending):
        self.portfolio.buy(symbol, reference_price, prices, day)
        return self.portfolio.trades[-1]

    def sell(self, symbol, reference_price, prices, day, client_id, on_pending):
        self.portfolio.sell(symbol, reference_price, prices, day)
        return self.portfolio.trades[-1]


class TestnetBroker:
    """Fictitious MARKET orders on Binance Spot Testnet, booked only when confirmed."""
    mode = "TESTNET"

    def __init__(self, portfolio, api, max_price_deviation="0.02"):
        self.portfolio = portfolio
        self.api = api
        self.max_price_deviation = dec(max_price_deviation)
        self._info = {}

    # --- exchange data -------------------------------------------------------
    def symbol_info(self, symbol):
        if symbol not in self._info:
            self._info[symbol] = self.api.symbol_info(symbol)
        return self._info[symbol]

    @staticmethod
    def _filters(info):
        return {f["filterType"]: f for f in info.get("filters", [])}

    def _step_and_min(self, info):
        filters = self._filters(info)
        steps = [dec(filters[n].get("stepSize", 0)) for n in ("LOT_SIZE", "MARKET_LOT_SIZE")
                 if n in filters]
        mins = [dec(filters[n].get("minQty", 0)) for n in ("LOT_SIZE", "MARKET_LOT_SIZE")
                if n in filters]
        return max(steps, default=Decimal(0)), max(mins, default=Decimal(0))

    def balances(self):
        account = self.api.account()
        return {b["asset"]: dec(b["free"]) + dec(b["locked"]) for b in account.get("balances", [])}, \
               {b["asset"]: dec(b["free"]) for b in account.get("balances", [])}

    def reconcile(self):
        """Fail closed if a local position is not backed by testnet balances."""
        totals, _ = self.balances()
        problems = []
        for symbol, quantity in sorted(self.portfolio.holdings.items()):
            if quantity > 0:
                base = symbol[:-len(QUOTE)]
                available = totals.get(base, Decimal(0))
                if available < quantity:
                    problems.append("%s local=%s testnet=%s" % (base, quantity, available))
        if problems:
            raise RuntimeError("TESTNET_DIVERGENTE: " + "; ".join(problems) +
                               ". A Testnet pode ter sido reiniciada; revise o arquivo de estado"
                               " antes de continuar.")
        return totals

    # --- fills ---------------------------------------------------------------
    def _book(self, order, side, symbol, details=None):
        """Book a confirmed exchange order into the local portfolio."""
        base = symbol[:-len(QUOTE)]
        executed = dec(order.get("executedQty", "0"))
        quote = dec(order.get("cummulativeQuoteQty", "0"))
        if executed <= 0:
            return None
        fee_base = fee_quote = Decimal(0)
        other = {}
        fills = order.get("fills")
        estimated = not fills
        if fills:
            for f in fills:
                asset, amount = f.get("commissionAsset"), dec(f.get("commission", "0"))
                if asset == base:
                    fee_base += amount
                elif asset == QUOTE:
                    fee_quote += amount
                else:
                    other[asset] = str(dec(other.get(asset, 0)) + amount)
        else:
            # Order lookups carry no commission detail; book the configured fee.
            rate = self.portfolio.limits.fee
            if side == "BUY":
                fee_base = executed * rate
            else:
                fee_quote = quote * rate
        info = {"order_id": order.get("orderId"), "client_id": order.get("clientOrderId"),
                "exchange_status": order.get("status"), "fee_base": str(fee_base),
                "fee_other": other, "fee_estimated": estimated}
        info.update(details or {})
        if side == "BUY":
            return self.portfolio.apply_fill("BUY", symbol, executed - fee_base, quote,
                                             fee_quote, details=info)
        held = self.portfolio.holdings.get(symbol, Decimal(0))
        trade = self.portfolio.apply_fill("SELL", symbol, min(held, executed + fee_base),
                                          quote, fee_quote, details=info)
        _, minimum = self._step_and_min(self.symbol_info(symbol))
        left = self.portfolio.holdings.get(symbol, Decimal(0))
        if 0 < left < minimum:
            # Below the exchange minimum: cannot be sold; write the dust off locally.
            self.portfolio.holdings[symbol] = Decimal(0)
            trade["dust_written_off"] = str(left)
        return trade

    def lookup(self, symbol, client_id):
        try:
            return self.api.order_by_client_id(symbol, client_id)
        except BinanceAPIError as exc:
            if exc.code == -2013:  # order does not exist
                return None
            raise

    def resolve_pending(self, pending):
        """Called at the start of a cycle for an order whose result is unknown."""
        order = self.lookup(pending["symbol"], pending["client_id"])
        if order is None:
            return None
        return self._book(order, pending["side"], pending["symbol"],
                          {"recovered": True, "reference_price": pending.get("reference_price")})

    def _submit(self, symbol, side, client_id, reference_price, on_pending, **amount):
        on_pending({"client_id": client_id, "symbol": symbol, "side": side,
                    "reference_price": reference_price})
        try:
            order = self.api.place_testnet_order(symbol, side, client_id=client_id, **amount)
        except BinanceAPIError as exc:
            if exc.status is not None and exc.status < 500:
                on_pending(None)  # rejected before execution: nothing happened
                raise RuntimeError("ORDEM_RECUSADA: %s" % exc) from None
            order = None  # 5xx: execution status unknown
        except RuntimeError:
            order = None  # network failure: unknown
        if order is None:
            try:
                order = self.lookup(symbol, client_id)
            except (RuntimeError, ValueError):
                order = None
            if order is None:
                # Keep the pending marker: the next cycle looks it up again.
                raise RuntimeError("ORDEM_INCERTA: resultado sera conferido no proximo ciclo")
        trade = self._book(order, side, symbol, {"reference_price": reference_price})
        on_pending(None)
        if trade is None:
            raise RuntimeError("ORDEM_SEM_EXECUCAO: status %s" % order.get("status"))
        return trade

    # --- orders --------------------------------------------------------------
    def _usable(self, info):
        if info.get("status") != "TRADING" or "MARKET" not in info.get("orderTypes", []):
            raise ValueError("PAR_INDISPONIVEL_NA_TESTNET")

    def buy(self, symbol, reference_price, prices, day, client_id, on_pending):
        equity = self.portfolio.check(prices, day)
        if self.portfolio.holdings.get(symbol, Decimal(0)) > 0:
            raise ValueError("Existing position")
        info = self.symbol_info(symbol)
        self._usable(info)
        if info.get("quoteOrderQtyMarketAllowed") is False:
            raise ValueError("PAR_SEM_COMPRA_POR_VALOR")
        spend = floor_to(min(self.portfolio.cash, equity * self.portfolio.limits.max_allocation), CENT)
        if spend <= 0:
            raise ValueError("Insufficient cash")
        testnet_price = dec(self.api.ticker_price(symbol))
        deviation = abs(testnet_price / dec(reference_price) - 1)
        if deviation > self.max_price_deviation:
            raise ValueError("TESTNET_PRICE_DEVIATION %.2f%%" % (deviation * 100))
        step, _ = self._step_and_min(info)
        estimated_qty = floor_to(spend * (1 - self.portfolio.limits.fee) / testnet_price, step)
        if not eligible_market_order(info, testnet_price, estimated_qty):
            raise ValueError("ORDER_BELOW_EXCHANGE_FILTERS")
        _, free = self.balances()
        if free.get(QUOTE, Decimal(0)) < spend:
            raise RuntimeError("TESTNET_USDT_INSUFICIENTE")
        return self._submit(symbol, "BUY", client_id, reference_price, on_pending,
                            quote_quantity=spend)

    def sell(self, symbol, reference_price, prices, day, client_id, on_pending):
        try:
            self.portfolio.check(prices, day)
        except RuntimeError as exc:
            if str(exc) not in LOSS_LIMITS:  # exits stay allowed after loss limits
                raise
        held = self.portfolio.holdings.get(symbol, Decimal(0))
        if held <= 0:
            raise ValueError("No position")
        info = self.symbol_info(symbol)
        self._usable(info)
        step, _ = self._step_and_min(info)
        _, free = self.balances()
        quantity = floor_to(min(held, free.get(symbol[:-len(QUOTE)], Decimal(0))), step)
        testnet_price = dec(self.api.ticker_price(symbol))
        if quantity <= 0 or not eligible_market_order(info, testnet_price, quantity):
            raise ValueError("POSITION_BELOW_EXCHANGE_MINIMUM")
        return self._submit(symbol, "SELL", client_id, reference_price, on_pending,
                            quantity=quantity)
