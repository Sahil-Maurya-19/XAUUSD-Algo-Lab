from pathlib import Path
import numpy as np
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.engine.backtester import run_backtest, run_custom_backtest
from app.strategies.rules import STRATEGIES, build_custom_strategy

app = FastAPI(title="XAUUSD Algo Strategy Lab")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
DATA_PATH = Path(__file__).parent / "data" / "xauusd_sample.csv"

class BacktestRequest(BaseModel):
    strategy: str = "goat_stop_breakout"
    initial_capital: float = 10000
    lot_size: float = 1
    contract_multiplier: float = 100
    commission_per_trade: float = 2
    slippage_points: float = 0.10
    monte_carlo_simulations: int = 1000


class CustomStrategyRequest(BaseModel):
    name: str = "My Custom Strategy"
    entry_type: str = "goat_stop_breakout"
    direction: str = "long_short"
    length: int = 20
    fast: int = 10
    slow: int = 40
    vol_length: int = 20
    exit_bars: int = 20
    trend_filter: str = "none"
    session_filter: str = "all"
    initial_capital: float = 10000
    lot_size: float = 1
    contract_multiplier: float = 100
    commission_per_trade: float = 2
    slippage_points: float = 0.10
    monte_carlo_simulations: int = 1000


def ensure_sample_data() -> pd.DataFrame:
    if DATA_PATH.exists():
        return pd.read_csv(DATA_PATH, parse_dates=["time"]).set_index("time")
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    rng = pd.date_range("2021-01-01", periods=1500, freq="4h")
    np.random.seed(7)
    trend = np.linspace(0, 350, len(rng))
    noise = np.random.normal(0, 12, len(rng)).cumsum()
    close = 1800 + trend + noise
    open_ = np.r_[close[0], close[:-1]]
    high = np.maximum(open_, close) + np.random.uniform(1, 8, len(rng))
    low = np.minimum(open_, close) - np.random.uniform(1, 8, len(rng))
    volume = np.random.randint(500, 3000, len(rng))
    df = pd.DataFrame({"time": rng, "open": open_, "high": high, "low": low, "close": close, "volume": volume})
    df.to_csv(DATA_PATH, index=False)
    return df.set_index("time")


def load_data() -> pd.DataFrame:
    return ensure_sample_data().dropna()

@app.get("/strategies")
def strategies():
    return [{"key": k, "label": v["label"], "params": v["params"], "exit_bars": v["exit_bars"]} for k, v in STRATEGIES.items()]

@app.post("/backtest")
def backtest(req: BacktestRequest):
    df = load_data()
    payload = req.model_dump()
    strategy_key = payload.pop("strategy")
    return run_backtest(df, strategy_key=strategy_key, **payload)

@app.post("/custom-backtest")
def custom_backtest(req: CustomStrategyRequest):
    df = load_data()
    payload = req.model_dump()
    strategy_name = payload.pop("name") or "My Custom Strategy"
    exit_bars = payload.pop("exit_bars")

    execution_kwargs = {
        "initial_capital": payload.pop("initial_capital"),
        "lot_size": payload.pop("lot_size"),
        "contract_multiplier": payload.pop("contract_multiplier"),
        "commission_per_trade": payload.pop("commission_per_trade"),
        "slippage_points": payload.pop("slippage_points"),
        "monte_carlo_simulations": payload.pop("monte_carlo_simulations"),
    }

    signals = build_custom_strategy(df, **payload)
    return run_custom_backtest(
        df=df,
        signals=signals,
        strategy_label=strategy_name,
        exit_bars=exit_bars,
        **execution_kwargs,
    )


@app.post("/advanced-backtest")
async def advanced_backtest(
    file: UploadFile = File(...),
    initial_capital: float = Form(10000),
    lot_size: float = Form(1),
    contract_multiplier: float = Form(100),
    commission_per_trade: float = Form(2),
    slippage_points: float = Form(0.10),
    monte_carlo_simulations: int = Form(1000),
):
    """Upload a Python strategy file and backtest it against the active XAUUSD dataset.

    Contract for uploaded file:
    - Define generate_signals(df) or strategy(df)
    - Return a pandas Series indexed like df with values: 1 long, -1 short, 0 flat
    - Optional constants: STRATEGY_NAME = "..." and EXIT_BARS = 20

    This is intended for local project/demo use. Do not expose arbitrary Python
    execution publicly without a real sandbox/container isolation layer.
    """
    if not file.filename.lower().endswith(".py"):
        raise HTTPException(status_code=400, detail="Please upload a .py strategy file.")

    try:
        source = (await file.read()).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Strategy file must be valid UTF-8 text.") from exc

    safe_builtins = {
        "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict, "enumerate": enumerate,
        "float": float, "int": int, "len": len, "list": list, "max": max, "min": min,
        "range": range, "round": round, "set": set, "str": str, "sum": sum, "tuple": tuple, "zip": zip,
    }
    namespace = {"pd": pd, "np": np, "__builtins__": safe_builtins}

    try:
        exec(compile(source, file.filename, "exec"), namespace)
        signal_fn = namespace.get("generate_signals") or namespace.get("strategy")
        if not callable(signal_fn):
            raise ValueError("Your file must define generate_signals(df) or strategy(df).")

        df = load_data()
        signals = signal_fn(df.copy())
        if not isinstance(signals, pd.Series):
            signals = pd.Series(signals, index=df.index)

        signals = signals.reindex(df.index).fillna(0).astype(float).clip(-1, 1).round().astype(int)
        exit_bars = int(namespace.get("EXIT_BARS", 20))
        strategy_name = str(namespace.get("STRATEGY_NAME", file.filename.rsplit('.', 1)[0]))

        return run_custom_backtest(
            df=df,
            signals=signals,
            strategy_label=strategy_name,
            exit_bars=exit_bars,
            initial_capital=initial_capital,
            lot_size=lot_size,
            contract_multiplier=contract_multiplier,
            commission_per_trade=commission_per_trade,
            slippage_points=slippage_points,
            monte_carlo_simulations=monte_carlo_simulations,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Strategy execution failed: {exc}") from exc

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read()
    DATA_PATH.write_bytes(content)
    return {"status": "uploaded", "filename": file.filename}
