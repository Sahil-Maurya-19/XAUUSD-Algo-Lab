import numpy as np
import pandas as pd


def max_drawdown(equity: pd.Series) -> tuple[float, pd.Series]:
    if equity.empty:
        return 0.0, equity
    peak = equity.cummax()
    dd = equity - peak
    return float(dd.min()), dd


def compute_metrics(trades: pd.DataFrame, equity: pd.Series, initial_capital: float) -> dict:
    pnl = trades["pnl"] if not trades.empty else pd.Series(dtype=float)
    wins = pnl[pnl > 0]
    losses = pnl[pnl < 0]
    gross_profit = float(wins.sum()) if len(wins) else 0.0
    gross_loss = float(losses.sum()) if len(losses) else 0.0
    net_profit = float(pnl.sum()) if len(pnl) else 0.0
    profit_factor = gross_profit / abs(gross_loss) if gross_loss != 0 else None
    win_rate = float(len(wins) / len(pnl) * 100) if len(pnl) else 0.0
    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = float(losses.mean()) if len(losses) else 0.0
    rr = abs(avg_win / avg_loss) if avg_loss != 0 else None
    mdd, dd = max_drawdown(equity)
    returns = equity.diff().fillna(0)
    sharpe = float((returns.mean() / returns.std()) * np.sqrt(252)) if returns.std() else 0.0
    downside = returns[returns < 0]
    sortino = float((returns.mean() / downside.std()) * np.sqrt(252)) if len(downside) and downside.std() else 0.0
    expectancy = float((win_rate / 100) * avg_win + (1 - win_rate / 100) * avg_loss) if len(pnl) else 0.0
    return {
        "initial_capital": initial_capital,
        "ending_equity": float(equity.iloc[-1]) if not equity.empty else initial_capital,
        "net_profit": net_profit,
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "profit_factor": profit_factor,
        "win_rate": win_rate,
        "loss_rate": 100 - win_rate if len(pnl) else 0.0,
        "max_drawdown": mdd,
        "max_drawdown_pct": float(mdd / equity.cummax().max() * 100) if not equity.empty and equity.cummax().max() else 0.0,
        "total_trades": int(len(pnl)),
        "winning_trades": int(len(wins)),
        "losing_trades": int(len(losses)),
        "average_win": avg_win,
        "average_loss": avg_loss,
        "risk_reward_ratio": rr,
        "expectancy": expectancy,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
    }


def _percentile(values: np.ndarray, q: float) -> float:
    if values.size == 0:
        return 0.0
    return float(np.percentile(values, q))


def _hist(values: np.ndarray, bins: int = 24, as_abs: bool = False) -> list[dict]:
    values = np.asarray(values, dtype=float)
    if values.size == 0:
        return []
    if np.all(values == values[0]):
        midpoint = abs(float(values[0])) if as_abs else float(values[0])
        return [{"bucket": f"{midpoint:.0f}", "count": int(values.size), "midpoint": round(midpoint, 2)}]
    counts, edges = np.histogram(values, bins=min(bins, max(8, int(np.sqrt(values.size)))))
    rows = []
    for idx, count in enumerate(counts):
        lo = abs(float(edges[idx])) if as_abs else float(edges[idx])
        hi = abs(float(edges[idx + 1])) if as_abs else float(edges[idx + 1])
        midpoint = abs(float((edges[idx] + edges[idx + 1]) / 2)) if as_abs else float((edges[idx] + edges[idx + 1]) / 2)
        rows.append({"bucket": f"{lo:.0f} to {hi:.0f}", "count": int(count), "midpoint": round(midpoint, 2)})
    return rows


def _drawdown_stats(full_path: np.ndarray) -> tuple[float, float, int, int]:
    peaks = np.maximum.accumulate(full_path)
    dd = full_path - peaks
    peak_safe = np.where(peaks == 0, 1.0, peaks)
    dd_pct = dd / peak_safe * 100
    max_dd = float(dd.min())
    max_dd_pct = float(dd_pct.min())

    underwater = dd < 0
    max_duration = 0
    recovery_times = []
    current = 0
    for is_underwater in underwater:
        if is_underwater:
            current += 1
        else:
            if current > 0:
                recovery_times.append(current)
            max_duration = max(max_duration, current)
            current = 0
    if current > 0:
        max_duration = max(max_duration, current)
        recovery_times.append(current)
    avg_recovery = int(round(float(np.mean(recovery_times)))) if recovery_times else 0
    return max_dd, max_dd_pct, int(max_duration), avg_recovery


def _path_from_pnl(pnl: np.ndarray, initial_capital: float) -> np.ndarray:
    return np.concatenate([[initial_capital], initial_capital + np.cumsum(pnl)])


def _simulate_with_pool(rng: np.random.Generator, pnl: np.ndarray, n: int, volatility_scale: float = 1.0, win_rate_shift: float = 0.0) -> np.ndarray:
    wins = pnl[pnl > 0]
    losses = pnl[pnl <= 0]
    if wins.size == 0 or losses.size == 0 or win_rate_shift == 0:
        return rng.choice(pnl * volatility_scale, size=n, replace=True)

    base_win_prob = wins.size / pnl.size
    adjusted_win_prob = float(np.clip(base_win_prob + win_rate_shift, 0.05, 0.95))
    is_win = rng.random(n) < adjusted_win_prob
    sampled = np.empty(n)
    sampled[is_win] = rng.choice(wins, size=int(is_win.sum()), replace=True)
    sampled[~is_win] = rng.choice(losses, size=int((~is_win).sum()), replace=True)
    return sampled * volatility_scale


def _scenario_result(name: str, sampled_pnl: np.ndarray, initial_capital: float, years: float) -> dict:
    path = _path_from_pnl(sampled_pnl, initial_capital)
    max_dd, max_dd_pct, dd_duration, recovery_time = _drawdown_stats(path)
    ending = float(path[-1])
    cagr = ((ending / initial_capital) ** (1 / years) - 1) * 100 if initial_capital > 0 and ending > 0 and years > 0 else -100.0
    return {
        "scenario": name,
        "ending_equity": round(ending, 2),
        "cagr_pct": round(float(cagr), 2),
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "max_drawdown_duration_trades": dd_duration,
        "avg_recovery_time_trades": recovery_time,
    }


def monte_carlo_simulation(
    trades: pd.DataFrame,
    initial_capital: float,
    simulations: int = 1000,
    seed: int = 42,
) -> dict:
    """Professional Monte Carlo stress test from historical trade PnL.

    Uses bootstrap resampling with replacement from historical trades. It estimates
    return distribution, maximum drawdown distribution, path survival, recovery
    behavior, VaR/CVaR, and robustness sensitivity to volatility/win-rate changes.
    """
    empty = {
        "simulations": 0,
        "trades_per_simulation": 0,
        "summary": {},
        "fan_chart": [],
        "sample_paths": [],
        "ending_equity_distribution": [],
        "max_drawdown_distribution": [],
        "drawdown_duration_distribution": [],
        "recovery_time_distribution": [],
        "cagr_distribution": [],
        "robustness": {"volatility_sensitivity": [], "win_rate_sensitivity": [], "sequence_stress_tests": []},
    }
    if trades.empty or "pnl" not in trades:
        return empty

    pnl = trades["pnl"].astype(float).dropna().to_numpy()
    n = len(pnl)
    if n == 0:
        return empty

    # Estimate the historical period to annualize CAGR. Fall back to one year.
    years = 1.0
    try:
        start = pd.to_datetime(trades["entry_time"].iloc[0])
        end = pd.to_datetime(trades["exit_time"].iloc[-1])
        years = max((end - start).days / 365.25, 1 / 365.25)
    except Exception:
        years = 1.0

    rng = np.random.default_rng(seed)
    sims = max(int(simulations), 100)

    paths = np.empty((sims, n + 1))
    ending_equities = np.empty(sims)
    total_returns = np.empty(sims)
    cagr_values = np.empty(sims)
    max_drawdowns = np.empty(sims)
    max_drawdown_pcts = np.empty(sims)
    dd_durations = np.empty(sims)
    recovery_times = np.empty(sims)
    min_equities = np.empty(sims)

    sample_paths = []
    path_slots = {0: "Path 1", max(1, sims // 3): "Path 2", max(2, 2 * sims // 3): "Path 3"}

    for i in range(sims):
        sampled_pnl = rng.choice(pnl, size=n, replace=True)
        path = _path_from_pnl(sampled_pnl, initial_capital)
        paths[i] = path
        max_dd, max_dd_pct, dd_duration, recovery_time = _drawdown_stats(path)

        ending = float(path[-1])
        ending_equities[i] = ending
        total_returns[i] = (ending - initial_capital) / initial_capital * 100
        cagr_values[i] = ((ending / initial_capital) ** (1 / years) - 1) * 100 if ending > 0 else -100.0
        max_drawdowns[i] = max_dd
        max_drawdown_pcts[i] = max_dd_pct
        dd_durations[i] = dd_duration
        recovery_times[i] = recovery_time
        min_equities[i] = float(path.min())

        if i in path_slots:
            sample_paths.extend({"trade": int(j), "equity": round(float(value), 2), "path": path_slots[i]} for j, value in enumerate(path))

    # Equity fan chart percentiles at each trade index.
    pcts = np.percentile(paths, [5, 25, 50, 75, 95], axis=0)
    fan_chart = [
        {
            "trade": int(j),
            "p05": round(float(pcts[0, j]), 2),
            "p25": round(float(pcts[1, j]), 2),
            "p50": round(float(pcts[2, j]), 2),
            "p75": round(float(pcts[3, j]), 2),
            "p95": round(float(pcts[4, j]), 2),
        }
        for j in range(n + 1)
    ]

    loss_probability = float(np.mean(ending_equities < initial_capital) * 100)
    ruin_threshold = initial_capital * 0.7
    risk_of_30pct_ruin = float(np.mean(min_equities <= ruin_threshold) * 100)
    var_95 = float(np.percentile(total_returns, 5))
    cvar_95 = float(total_returns[total_returns <= var_95].mean()) if np.any(total_returns <= var_95) else var_95
    var_99 = float(np.percentile(total_returns, 1))
    cvar_99 = float(total_returns[total_returns <= var_99].mean()) if np.any(total_returns <= var_99) else var_99

    # Robustness sensitivity: how fragile is the strategy if volatility or hit-rate changes?
    volatility_sensitivity = []
    for scale in [0.75, 1.0, 1.25, 1.5]:
        endings, dds = [], []
        for _ in range(250):
            sampled = _simulate_with_pool(rng, pnl, n, volatility_scale=scale)
            scenario = _scenario_result(f"{scale:.2f}x volatility", sampled, initial_capital, years)
            endings.append(scenario["ending_equity"])
            dds.append(scenario["max_drawdown"])
        volatility_sensitivity.append({
            "scenario": f"{scale:.2f}x Vol",
            "median_ending_equity": round(_percentile(np.asarray(endings), 50), 2),
            "worst_5pct_ending_equity": round(_percentile(np.asarray(endings), 5), 2),
            "median_max_drawdown": round(_percentile(np.asarray(dds), 50), 2),
        })

    win_rate_sensitivity = []
    for shift in [-0.10, -0.05, 0.0, 0.05, 0.10]:
        endings, dds = [], []
        for _ in range(250):
            sampled = _simulate_with_pool(rng, pnl, n, volatility_scale=1.0, win_rate_shift=shift)
            scenario = _scenario_result(f"{shift:+.0%} win-rate", sampled, initial_capital, years)
            endings.append(scenario["ending_equity"])
            dds.append(scenario["max_drawdown"])
        win_rate_sensitivity.append({
            "scenario": f"{shift:+.0%} Win Rate",
            "median_ending_equity": round(_percentile(np.asarray(endings), 50), 2),
            "worst_5pct_ending_equity": round(_percentile(np.asarray(endings), 5), 2),
            "median_max_drawdown": round(_percentile(np.asarray(dds), 50), 2),
        })

    sorted_losses_first = np.concatenate([np.sort(pnl), np.sort(pnl)[::-1]])[:n]
    sorted_wins_first = np.sort(pnl)[::-1]
    random_once = rng.choice(pnl, size=n, replace=False) if n > 1 else pnl
    sequence_stress_tests = [
        _scenario_result("Original Backtest Order", pnl, initial_capital, years),
        _scenario_result("Random Shuffle Once", random_once, initial_capital, years),
        _scenario_result("Losses First Stress", sorted_losses_first, initial_capital, years),
        _scenario_result("Winners First Stress", sorted_wins_first, initial_capital, years),
    ]

    return {
        "simulations": sims,
        "trades_per_simulation": n,
        "summary": {
            "mean_ending_equity": round(float(np.mean(ending_equities)), 2),
            "median_ending_equity": round(_percentile(ending_equities, 50), 2),
            "p05_ending_equity": round(_percentile(ending_equities, 5), 2),
            "p95_ending_equity": round(_percentile(ending_equities, 95), 2),
            "mean_cagr_pct": round(float(np.mean(cagr_values)), 2),
            "median_cagr_pct": round(_percentile(cagr_values, 50), 2),
            "p05_cagr_pct": round(_percentile(cagr_values, 5), 2),
            "p95_cagr_pct": round(_percentile(cagr_values, 95), 2),
            "win_probability_pct": round(float(np.mean(ending_equities > initial_capital) * 100), 2),
            "loss_probability_pct": round(loss_probability, 2),
            "risk_of_30pct_ruin_pct": round(risk_of_30pct_ruin, 2),
            "var_95_pct": round(var_95, 2),
            "cvar_95_pct": round(cvar_95, 2),
            "var_99_pct": round(var_99, 2),
            "cvar_99_pct": round(cvar_99, 2),
            "median_max_drawdown": round(_percentile(max_drawdowns, 50), 2),
            "p05_max_drawdown": round(_percentile(max_drawdowns, 5), 2),
            "p95_max_drawdown": round(_percentile(max_drawdowns, 95), 2),
            "median_max_drawdown_pct": round(_percentile(max_drawdown_pcts, 50), 2),
            "worst_5pct_max_drawdown_pct": round(_percentile(max_drawdown_pcts, 5), 2),
            "median_drawdown_duration_trades": round(_percentile(dd_durations, 50), 2),
            "p95_drawdown_duration_trades": round(_percentile(dd_durations, 95), 2),
            "median_recovery_time_trades": round(_percentile(recovery_times, 50), 2),
            "p95_recovery_time_trades": round(_percentile(recovery_times, 95), 2),
        },
        "fan_chart": fan_chart,
        "sample_paths": sample_paths,
        "ending_equity_distribution": _hist(ending_equities),
        "max_drawdown_distribution": _hist(max_drawdowns, as_abs=True),
        "drawdown_duration_distribution": _hist(dd_durations),
        "recovery_time_distribution": _hist(recovery_times),
        "cagr_distribution": _hist(cagr_values),
        "robustness": {
            "volatility_sensitivity": volatility_sensitivity,
            "win_rate_sensitivity": win_rate_sensitivity,
            "sequence_stress_tests": sequence_stress_tests,
        },
    }
