"""
Advanced Mode strategy template for XAUUSD Algo Trading Lab.

Upload this .py file from the website's Advanced Mode tab.
Rules:
- Do not import pandas/numpy; pd and np are already available.
- Define generate_signals(df).
- Return a Series with values: 1 = long, -1 = short, 0 = flat.
- Optional: STRATEGY_NAME and EXIT_BARS.
"""

STRATEGY_NAME = "EMA 20/50 Trend Strategy"
EXIT_BARS = 30


def generate_signals(df):
    ema_fast = df["close"].ewm(span=20, adjust=False).mean()
    ema_slow = df["close"].ewm(span=50, adjust=False).mean()

    signals = pd.Series(0, index=df.index)
    bullish_cross = (ema_fast > ema_slow) & (ema_fast.shift(1) <= ema_slow.shift(1))
    bearish_cross = (ema_fast < ema_slow) & (ema_fast.shift(1) >= ema_slow.shift(1))

    signals[bullish_cross] = 1
    signals[bearish_cross] = -1
    return signals
