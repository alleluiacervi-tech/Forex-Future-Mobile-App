"""
Production-ready Forex alert engine designed for volatility-adjusted, pair-aware,
timeframe-aware notifications.  Modelled on hedge-fund quality systems.

Architecture:
  * data layer: price/candle retrieval (stubbed for this example).
  * indicator layer: ATR, ROC, breakout highs/lows, pip/percentage conversion.
  * alert engine: applies modular filters in order, maintains state and cooldowns.
  * notification service: abstracted for sending messages.

Configuration is handled via a simple dataclass but could easily be
populated from a database or user interface.

Example usage and simple tests provided at the bottom.

"""
from dataclasses import dataclass, field
from typing import List, Optional, Callable
import math
import time

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

JPY_PAIRS = {"JPY"}


def is_jpy_pair(pair: str) -> bool:
    return "JPY" in pair.upper()


def pip_size(pair: str) -> float:
    """Return pip size for instrument.

    Most pairs 0.0001, JPY pairs 0.01.
    """
    return 0.01 if is_jpy_pair(pair) else 0.0001


def price_to_pips(pair: str, price_diff: float) -> float:
    return price_diff / pip_size(pair)


def percentage_change(reference: float, current: float) -> float:
    return (current - reference) / reference * 100 if reference != 0 else 0

# -----------------------------------------------------------------------------
# Data / Indicator layer
# -----------------------------------------------------------------------------

@dataclass
class Candle:
    ts: float            # epoch seconds
    high: float
    low: float
    close: float


def compute_atr(candles: List[Candle], period: int = 14) -> Optional[float]:
    """Simple ATR (14-period by default) on candle list (oldest first)."""
    if len(candles) < period + 1:
        return None
    trs = []
    for i in range(1, len(candles)):
        prev_close = candles[i - 1].close
        high = candles[i].high
        low = candles[i].low
        trs.append(max(high - low,
                       abs(high - prev_close),
                       abs(low - prev_close)))
    # only average last `period` TRs
    return sum(trs[-period:]) / period if trs else None

# -----------------------------------------------------------------------------
# Alert configuration
# -----------------------------------------------------------------------------

@dataclass
class AlertConfig:
    pip_threshold: float                        # pips from reference
    percent_threshold: Optional[float] = None   # percent change threshold
    atr_multiplier: float = 0.5                 # require move >= mult * ATR
    time_window_mins: float = 5.0               # X pips within Y mins
    spread_thresh: float = 5.0                  # maximum acceptable spread in pips
    cooldown_secs: float = 60.0                 # minimum seconds between alerts
    breakout_lookback: int = 20                 # number of candles for structural break
    use_breakout: bool = False                  # advanced mode

# -----------------------------------------------------------------------------
# Alert engine
# -----------------------------------------------------------------------------

@dataclass
class ReferenceState:
    last_alert_price: Optional[float] = None
    last_alert_ts: Optional[float] = None
    reference_price: Optional[float] = None   # could be candle close or last alert


class AlertEngine:
    def __init__(self,
                 pair: str,
                 config: AlertConfig,
                 fetch_candles: Callable[[str, int], List[Candle]],
                 notifier: Callable[[str, dict], None]):
        self.pair = pair
        self.config = config
        self.state = ReferenceState()
        self.fetch_candles = fetch_candles
        self.notifier = notifier

    def _within_cooldown(self, price: float, ts: float) -> bool:
        if self.state.last_alert_ts is None:
            return False
        dt = ts - self.state.last_alert_ts
        if dt < self.config.cooldown_secs:
            # still in cooldown unless price has moved additional threshold
            extra_pips = price_to_pips(self.pair, abs(price - self.state.last_alert_price))
            return extra_pips < self.config.pip_threshold
        return False

    def _check_spread(self, bid: float, ask: float) -> bool:
        spread = price_to_pips(self.pair, ask - bid)
        return spread <= self.config.spread_thresh

    def _check_pip_threshold(self, price: float) -> bool:
        ref = self.state.reference_price or price
        pips = price_to_pips(self.pair, abs(price - ref))
        return pips >= self.config.pip_threshold

    def _check_percent(self, price: float) -> bool:
        if self.config.percent_threshold is None:
            return True
        ref = self.state.reference_price or price
        pct = percentage_change(ref, price)
        return abs(pct) >= self.config.percent_threshold

    def _check_atr(self, price: float) -> bool:
        candles = self.fetch_candles(self.pair, self.config.breakout_lookback)
        atr = compute_atr(candles, period=14)
        if atr is None:
            return True
        threshold = atr * self.config.atr_multiplier
        return abs(price - (self.state.reference_price or price)) >= threshold

    def _check_rate_of_change(self, price: float, ts: float) -> bool:
        # simplistic: look back window of time_window_mins and see price movement
        lookback_secs = self.config.time_window_mins * 60
        # assume we have access to candles with timestamp
        candles = self.fetch_candles(self.pair, 100)
        lookback_candle = None
        for c in reversed(candles):  # newest first
            if ts - c.ts <= lookback_secs:
                lookback_candle = c
            else:
                break
        if lookback_candle is None:
            return True
        pips = price_to_pips(self.pair, abs(price - lookback_candle.close))
        return pips >= self.config.pip_threshold

    def _check_breakout(self, price: float) -> bool:
        if not self.config.use_breakout:
            return True
        candles = self.fetch_candles(self.pair, self.config.breakout_lookback)
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]
        if not highs or not lows:
            return True
        high = max(highs)
        low = min(lows)
        return price > high or price < low

    def evaluate_tick(self, bid: float, ask: float, price: float, ts: float):
        """Main entry point.  Evaluate a new quote/tick and potentially fire alerts."""
        # step 1: spread filter
        if not self._check_spread(bid, ask):
            return None

        # step 2: cooldown
        if self._within_cooldown(price, ts):
            return None

        # apply filters sequentially; any failure short-circuits
        if not self._check_pip_threshold(price):
            return None
        if not self._check_percent(price):
            return None
        if not self._check_atr(price):
            return None
        if not self._check_rate_of_change(price, ts):
            return None
        if not self._check_breakout(price):
            return None

        # all filters passed: send alert
        alert = {
            "pair": self.pair,
            "price": price,
            "ts": ts,
            "bid": bid,
            "ask": ask,
        }
        self.notifier("price_alert", alert)
        # update state
        self.state.last_alert_price = price
        self.state.last_alert_ts = ts
        self.state.reference_price = price
        return alert

# -----------------------------------------------------------------------------
# Example notification & data stubs
# -----------------------------------------------------------------------------

def dummy_notifier(evt: str, data: dict):
    print(f"NOTIFY {evt}: {data}")


def dummy_fetch(pair: str, count: int) -> List[Candle]:
    """Return synthetic candles for tests; normally hit database or cache."""
    now = time.time()
    candles = []
    price = 1.0
    for i in range(count):
        candles.append(Candle(ts=now - (count - i) * 60,
                              high=price + 0.001,
                              low=price - 0.001,
                              close=price))
        price += 0.0001
    return candles

# -----------------------------------------------------------------------------
# Simple test harness
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    config = AlertConfig(pip_threshold=5, percent_threshold=0.05,
                         atr_multiplier=0.5, time_window_mins=2,
                         spread_thresh=2, cooldown_secs=30,
                         breakout_lookback=10, use_breakout=True)
    engine = AlertEngine("EUR/USD", config, dummy_fetch, dummy_notifier)
    now = time.time()

    print("--- noisy tick (should not alert)")
    engine.evaluate_tick(1.0000, 1.0001, 1.0001, now)
    print("--- large move (should alert)")
    engine.evaluate_tick(1.0000, 1.0002, 1.0010, now + 10)
    print("--- small drift within window (no alert)")
    engine.evaluate_tick(1.0001, 1.0003, 1.0011, now + 60)

