# XAUUSD Algo Trading Lab

A full-stack XAUUSD strategy backtesting dashboard with:

- Preset Peak-style strategies
- Custom Strategy Builder tab
- Advanced Mode Python upload tab
- Equity curve
- Drawdown curve
- PnL distribution
- Win rate
- Profit factor
- Gross profit / gross loss
- Trade log

## Run backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

## Advanced Mode Python contract

Upload a `.py` file that defines:

```python
def generate_signals(df):
    # df columns: open, high, low, close, volume
    # return 1 for long, -1 for short, 0 for flat
    return signals
```

Optional constants:

```python
STRATEGY_NAME = "My Strategy"
EXIT_BARS = 20
```

Use `sample_strategy_template.py` as a starter file.

> Advanced Mode executes uploaded Python locally for demo/project use. Do not expose this endpoint on a public server without proper sandbox isolation.
