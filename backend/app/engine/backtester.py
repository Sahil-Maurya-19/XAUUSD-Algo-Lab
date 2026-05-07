from __future__ import annotations
import pandas as pd
from app.engine.metrics import compute_metrics, max_drawdown, monte_carlo_simulation
from app.strategies.rules import STRATEGIES


def _simulate_backtest(
    df: pd.DataFrame,
    signals: pd.Series,
    strategy_key: str,
    strategy_label: str,
    exit_bars: int,
    initial_capital: float = 10_000.0,
    lot_size: float = 1.0,
    contract_multiplier: float = 100.0,
    commission_per_trade: float = 2.0,
    slippage_points: float = 0.10,
    monte_carlo_simulations: int = 1000,
) -> dict:
    signals = signals.reindex(df.index).fillna(0)
    exit_bars = max(int(exit_bars), 1)

    equity = []
    trades = []
    capital = initial_capital
    position = 0
    entry_price = 0.0
    entry_time = None
    bars_in_trade = 0

    for ts, row in df.iterrows():
        price = float(row["close"])
        sig = int(signals.loc[ts])
        current_equity = capital
        if position:
            unrealized = (price - entry_price) * position * lot_size * contract_multiplier
            current_equity += unrealized
        equity.append((ts, current_equity))

        should_exit = False
        reason = None
        if position and bars_in_trade >= exit_bars:
            should_exit = True
            reason = "time_exit"
        if position and sig != 0 and sig != position:
            should_exit = True
            reason = "opposite_signal"

        if should_exit:
            exit_price = price - position * slippage_points
            pnl = (exit_price - entry_price) * position * lot_size * contract_multiplier - commission_per_trade
            capital += pnl
            trades.append({
                "entry_time": entry_time, "exit_time": ts, "side": "long" if position == 1 else "short",
                "entry_price": entry_price, "exit_price": exit_price, "pnl": pnl, "bars_held": bars_in_trade, "exit_reason": reason
            })
            position = 0
            entry_price = 0.0
            entry_time = None
            bars_in_trade = 0

        if position == 0 and sig != 0:
            position = sig
            entry_price = price + position * slippage_points
            entry_time = ts
            bars_in_trade = 0
            capital -= commission_per_trade

        if position:
            bars_in_trade += 1

    if position:
        ts = df.index[-1]
        price = float(df.iloc[-1]["close"])
        exit_price = price - position * slippage_points
        pnl = (exit_price - entry_price) * position * lot_size * contract_multiplier - commission_per_trade
        capital += pnl
        trades.append({
            "entry_time": entry_time, "exit_time": ts, "side": "long" if position == 1 else "short",
            "entry_price": entry_price, "exit_price": exit_price, "pnl": pnl, "bars_held": bars_in_trade, "exit_reason": "end_of_data"
        })
        equity.append((ts, capital))

    equity_s = pd.Series([x[1] for x in equity], index=[x[0] for x in equity]).drop_duplicates()
    trades_df = pd.DataFrame(trades)
    _, dd = max_drawdown(equity_s)
    metrics = compute_metrics(trades_df, equity_s, initial_capital)
    monte_carlo = monte_carlo_simulation(trades_df, initial_capital=initial_capital, simulations=monte_carlo_simulations)

    return {
        "strategy": strategy_key,
        "strategy_label": strategy_label,
        "metrics": metrics,
        "equity_curve": [{"time": str(i), "equity": float(v)} for i, v in equity_s.items()],
        "drawdown_curve": [{"time": str(i), "drawdown": float(v)} for i, v in dd.items()],
        "pnl_distribution": trades_df["pnl"].round(2).tolist() if not trades_df.empty else [],
        "trades": trades_df.round(4).astype(str).to_dict("records") if not trades_df.empty else [],
        "monte_carlo": monte_carlo,
    }


def run_backtest(
    df: pd.DataFrame,
    strategy_key: str,
    initial_capital: float = 10_000.0,
    lot_size: float = 1.0,
    contract_multiplier: float = 100.0,
    commission_per_trade: float = 2.0,
    slippage_points: float = 0.10,
    monte_carlo_simulations: int = 1000,
) -> dict:
    if strategy_key not in STRATEGIES:
        raise ValueError(f"Unknown strategy: {strategy_key}")
    cfg = STRATEGIES[strategy_key]
    signals = cfg["fn"](df, **cfg["params"]).fillna(0)
    return _simulate_backtest(
        df=df,
        signals=signals,
        strategy_key=strategy_key,
        strategy_label=cfg["label"],
        exit_bars=cfg["exit_bars"],
        initial_capital=initial_capital,
        lot_size=lot_size,
        contract_multiplier=contract_multiplier,
        commission_per_trade=commission_per_trade,
        slippage_points=slippage_points,
        monte_carlo_simulations=monte_carlo_simulations,
    )


def run_custom_backtest(
    df: pd.DataFrame,
    signals: pd.Series,
    strategy_label: str,
    exit_bars: int,
    initial_capital: float = 10_000.0,
    lot_size: float = 1.0,
    contract_multiplier: float = 100.0,
    commission_per_trade: float = 2.0,
    slippage_points: float = 0.10,
    monte_carlo_simulations: int = 1000,
) -> dict:
    return _simulate_backtest(
        df=df,
        signals=signals,
        strategy_key="custom_strategy",
        strategy_label=strategy_label,
        exit_bars=exit_bars,
        initial_capital=initial_capital,
        lot_size=lot_size,
        contract_multiplier=contract_multiplier,
        commission_per_trade=commission_per_trade,
        slippage_points=slippage_points,
        monte_carlo_simulations=monte_carlo_simulations,
    )
