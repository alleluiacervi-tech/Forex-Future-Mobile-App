"""Unit tests for alert_engine demonstrating meaningful vs noise alerts."""
import time
from alert_engine import AlertEngine, AlertConfig, Candle


def fake_fetch(pair: str, count: int):
    # very simple deterministic candles: each minute price moves 0.0005
    now = time.time()
    candles = []
    price = 1.0000
    for i in range(count):
        candles.append(Candle(ts=now - (count - i) * 60,
                              high=price + 0.0002,
                              low=price - 0.0002,
                              close=price))
        price += 0.0005
    return candles


def dummy_notifier(evt, data):
    dummy_notifier.last = data


def test_no_signal_on_noise():
    config = AlertConfig(pip_threshold=10, atr_multiplier=0.5)
    eng = AlertEngine("EUR/USD", config, fake_fetch, dummy_notifier)
    now = time.time()
    eng.evaluate_tick(1.0000, 1.0001, 1.0001, now)
    assert not hasattr(dummy_notifier, 'last')


def test_signal_on_volatility():
    config = AlertConfig(pip_threshold=1, atr_multiplier=0.1)
    eng = AlertEngine("EUR/USD", config, fake_fetch, dummy_notifier)
    now = time.time()
    eng.evaluate_tick(1.0000, 1.0001, 1.0010, now)
    assert dummy_notifier.last['price'] == 1.0010


def test_breakout():
    config = AlertConfig(pip_threshold=1, atr_multiplier=0.1, use_breakout=True, breakout_lookback=5)
    eng = AlertEngine("EUR/USD", config, fake_fetch, dummy_notifier)
    now = time.time()
    # price above all recent highs
    eng.evaluate_tick(1.0000, 1.0001, 1.0100, now)
    assert dummy_notifier.last['price'] == 1.0100


if __name__ == '__main__':
    test_no_signal_on_noise()
    test_signal_on_volatility()
    test_breakout()
    print("tests passed")
