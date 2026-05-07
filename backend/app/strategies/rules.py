import pandas as pd


def breakout_close(df: pd.DataFrame, length: int = 20) -> pd.Series:
    hh = df["close"].rolling(length).max().shift(1)
    ll = df["close"].rolling(length).min().shift(1)
    sig = pd.Series(0, index=df.index)
    sig[df["close"] > hh] = 1
    sig[df["close"] < ll] = -1
    return sig


def goat_stop_breakout(df: pd.DataFrame, length: int = 10) -> pd.Series:
    hh = df["high"].rolling(length).max().shift(1)
    ll = df["low"].rolling(length).min().shift(1)
    sig = pd.Series(0, index=df.index)
    sig[df["high"] >= hh] = 1
    sig[df["low"] <= ll] = -1
    return sig


def mean_reversion(df: pd.DataFrame, length: int = 20) -> pd.Series:
    hh = df["close"].rolling(length).max().shift(1)
    ll = df["close"].rolling(length).min().shift(1)
    sig = pd.Series(0, index=df.index)
    sig[df["close"] >= hh] = -1
    sig[df["close"] <= ll] = 1
    return sig


def low_volume_reversal(df: pd.DataFrame, length: int = 35, vol_length: int = 20) -> pd.Series:
    avg_vol = df["volume"].rolling(vol_length).mean().shift(1)
    low_vol = df["volume"] < avg_vol
    base = mean_reversion(df, length)
    return base.where(low_vol, 0)


def dueling_momentum(df: pd.DataFrame, fast: int = 15, slow: int = 50) -> pd.Series:
    sig = pd.Series(0, index=df.index)
    short_up = df["close"] > df["close"].shift(fast)
    long_down = df["close"] < df["close"].shift(slow)
    short_down = df["close"] < df["close"].shift(fast)
    long_up = df["close"] > df["close"].shift(slow)
    sig[short_up & long_down] = 1
    sig[short_down & long_up] = -1
    return sig


def ma_crossover(df: pd.DataFrame, fast: int = 10, slow: int = 40) -> pd.Series:
    ma_fast = df["close"].rolling(fast).mean()
    ma_slow = df["close"].rolling(slow).mean()
    sig = pd.Series(0, index=df.index)
    sig[(ma_fast > ma_slow) & (ma_fast.shift(1) <= ma_slow.shift(1))] = 1
    sig[(ma_fast < ma_slow) & (ma_fast.shift(1) >= ma_slow.shift(1))] = -1
    return sig


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False).mean()


def atr(df: pd.DataFrame, length: int = 14) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift(1)).abs()
    low_close = (df["low"] - df["close"].shift(1)).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(length).mean()


def rsi(series: pd.Series, length: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(length).mean()
    loss = (-delta.clip(upper=0)).rolling(length).mean()
    rs = gain / loss.replace(0, pd.NA)
    return 100 - (100 / (1 + rs))


def build_custom_strategy(
    df: pd.DataFrame,
    entry_type: str = "goat_stop_breakout",
    direction: str = "long_short",
    length: int = 20,
    fast: int = 10,
    slow: int = 40,
    vol_length: int = 20,
    trend_filter: str = "none",
    session_filter: str = "all",
) -> pd.Series:
    length = max(int(length), 2)
    fast = max(int(fast), 2)
    slow = max(int(slow), fast + 1)
    vol_length = max(int(vol_length), 2)

    if entry_type == "close_breakout":
        sig = breakout_close(df, length)
    elif entry_type == "goat_stop_breakout":
        sig = goat_stop_breakout(df, length)
    elif entry_type == "mean_reversion":
        sig = mean_reversion(df, length)
    elif entry_type == "low_volume_reversal":
        sig = low_volume_reversal(df, length, vol_length)
    elif entry_type == "dueling_momentum":
        sig = dueling_momentum(df, fast, slow)
    elif entry_type == "ma_crossover":
        sig = ma_crossover(df, fast, slow)
    elif entry_type == "rsi_reversion":
        r = rsi(df["close"], length)
        sig = pd.Series(0, index=df.index)
        sig[r < 30] = 1
        sig[r > 70] = -1
    elif entry_type == "ema_pullback":
        e_fast = ema(df["close"], fast)
        e_slow = ema(df["close"], slow)
        sig = pd.Series(0, index=df.index)
        pullback_long = (df["low"] <= e_fast) & (df["close"] > e_fast) & (e_fast > e_slow)
        pullback_short = (df["high"] >= e_fast) & (df["close"] < e_fast) & (e_fast < e_slow)
        sig[pullback_long] = 1
        sig[pullback_short] = -1
    else:
        raise ValueError(f"Unsupported custom entry type: {entry_type}")

    if direction == "long_only":
        sig = sig.where(sig > 0, 0)
    elif direction == "short_only":
        sig = sig.where(sig < 0, 0)

    if trend_filter != "none":
        e200 = ema(df["close"], 200)
        if trend_filter == "with_ema_200":
            sig = sig.where(((sig > 0) & (df["close"] > e200)) | ((sig < 0) & (df["close"] < e200)), 0)
        elif trend_filter == "against_ema_200":
            sig = sig.where(((sig > 0) & (df["close"] < e200)) | ((sig < 0) & (df["close"] > e200)), 0)

    if session_filter != "all":
        hours = pd.Series(df.index.hour, index=df.index)
        if session_filter == "london":
            allowed = hours.between(7, 11)
        elif session_filter == "new_york":
            allowed = hours.between(13, 17)
        elif session_filter == "london_new_york":
            allowed = hours.between(7, 17)
        else:
            allowed = pd.Series(True, index=df.index)
        sig = sig.where(allowed, 0)

    return sig.fillna(0)

STRATEGIES = {
    "goat_stop_breakout": {"label": "GOAT Stop Breakout + Time Exit", "fn": goat_stop_breakout, "params": {"length": 10}, "exit_bars": 20},
    "breakout_close": {"label": "Close Breakout", "fn": breakout_close, "params": {"length": 20}, "exit_bars": 20},
    "mean_reversion": {"label": "Mean Reversion", "fn": mean_reversion, "params": {"length": 20}, "exit_bars": 15},
    "low_volume_reversal": {"label": "Low Volume Reversal", "fn": low_volume_reversal, "params": {"length": 35, "vol_length": 20}, "exit_bars": 20},
    "dueling_momentum": {"label": "Dueling Momentum", "fn": dueling_momentum, "params": {"fast": 15, "slow": 50}, "exit_bars": 30},
    "ma_crossover": {"label": "Moving Average Crossover", "fn": ma_crossover, "params": {"fast": 10, "slow": 40}, "exit_bars": 40},
}
