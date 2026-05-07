import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TrendingUp, Activity, ShieldAlert, DollarSign, SlidersHorizontal, PlayCircle, UploadCloud, Code2, Save, Trash2 } from 'lucide-react';
import './style.css';

const API = 'http://localhost:8000';
const SAVED_PRESETS_KEY = 'xauusd_saved_custom_presets_v1';

const money = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const moneyAxis = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

const chartNumber = (v) => Number(v || 0).toFixed(2);
const pct = (v) => `${Number(v || 0).toFixed(2)}%`;

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #dbeafe',
  borderRadius: 14,
  color: '#0f172a',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
};

const entryOptions = [
  ['goat_stop_breakout', 'GOAT Stop Breakout'],
  ['close_breakout', 'Close Breakout'],
  ['mean_reversion', 'Mean Reversion'],
  ['low_volume_reversal', 'Low Volume Reversal'],
  ['dueling_momentum', 'Dueling Momentum'],
  ['ma_crossover', 'Moving Average Crossover'],
  ['rsi_reversion', 'RSI Reversion'],
  ['ema_pullback', 'EMA Pullback Continuation'],
];

const defaultCustom = {
  name: 'My XAUUSD Custom Strategy',
  entry_type: 'goat_stop_breakout',
  direction: 'long_short',
  length: 20,
  fast: 10,
  slow: 40,
  vol_length: 20,
  exit_bars: 20,
  trend_filter: 'none',
  session_filter: 'all',
};

function MetricCard({ title, value, icon: Icon, tone = 'blue', description }) {
  return (
    <div className={`card metric metric-${tone} ${description ? 'metricExplained' : ''}`}>
      <div className="metricBody">
        <p>{title}</p>
        <h2>{value}</h2>
        {description && <span className="metricDescription">{description}</span>}
      </div>
      <div className="metricIcon"><Icon size={22} /></div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card chart">
      <div className="chartHeader">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Dashboard({ data }) {
  const hist = useMemo(() => {
    if (!data?.pnl_distribution) return [];
    return data.pnl_distribution.slice(-80).map((pnl, i) => ({
      trade: i + 1,
      pnl: Number(Number(pnl).toFixed(2)),
      positive: Number(pnl) >= 0,
    }));
  }, [data]);

  const equityCurve = useMemo(() => {
    if (!data?.equity_curve) return [];
    return data.equity_curve.map((row) => ({ ...row, equity: Number(Number(row.equity || 0).toFixed(2)) }));
  }, [data]);

  const drawdownCurve = useMemo(() => {
    if (!data?.drawdown_curve) return [];
    return data.drawdown_curve.map((row) => ({ ...row, drawdown: Number(Number(row.drawdown || 0).toFixed(2)) }));
  }, [data]);

  const m = data?.metrics || {};
  const mc = data?.monte_carlo || {};
  const mcSummary = mc.summary || {};
  const mcRobustness = mc.robustness || {};

  const mcPathChart = useMemo(() => {
    const rows = {};
    (data?.monte_carlo?.sample_paths || []).forEach((point) => {
      const trade = point.trade;
      if (!rows[trade]) rows[trade] = { trade };
      rows[trade][point.path] = Number(Number(point.equity || 0).toFixed(2));
    });
    return Object.values(rows).sort((a, b) => a.trade - b.trade);
  }, [data]);

  const fanChart = useMemo(() => {
    return (data?.monte_carlo?.fan_chart || []).map((row) => ({
      trade: row.trade,
      p05: Number(Number(row.p05 || 0).toFixed(2)),
      p25: Number(Number(row.p25 || 0).toFixed(2)),
      p50: Number(Number(row.p50 || 0).toFixed(2)),
      p75: Number(Number(row.p75 || 0).toFixed(2)),
      p95: Number(Number(row.p95 || 0).toFixed(2)),
    }));
  }, [data]);

  const mcEndingHist = useMemo(() => {
    return (data?.monte_carlo?.ending_equity_distribution || []).map((row, i) => ({
      bucketIndex: i + 1,
      bucket: row.bucket,
      count: row.count,
      midpoint: Number(Number(row.midpoint || 0).toFixed(2)),
    }));
  }, [data]);

  const mcDrawdownHist = useMemo(() => {
    return (data?.monte_carlo?.max_drawdown_distribution || []).map((row, i) => ({
      bucketIndex: i + 1,
      bucket: row.bucket,
      count: row.count,
      midpoint: Number(Number(row.midpoint || 0).toFixed(2)),
    }));
  }, [data]);

  const mcRecoveryHist = useMemo(() => {
    return (data?.monte_carlo?.recovery_time_distribution || []).map((row, i) => ({
      bucketIndex: i + 1,
      bucket: row.bucket,
      count: row.count,
      midpoint: Number(Number(row.midpoint || 0).toFixed(2)),
    }));
  }, [data]);

  const mcDurationHist = useMemo(() => {
    return (data?.monte_carlo?.drawdown_duration_distribution || []).map((row, i) => ({
      bucketIndex: i + 1,
      bucket: row.bucket,
      count: row.count,
      midpoint: Number(Number(row.midpoint || 0).toFixed(2)),
    }));
  }, [data]);

  const cagrHist = useMemo(() => {
    return (data?.monte_carlo?.cagr_distribution || []).map((row, i) => ({
      bucketIndex: i + 1,
      bucket: row.bucket,
      count: row.count,
      midpoint: Number(Number(row.midpoint || 0).toFixed(2)),
    }));
  }, [data]);

  const volatilitySensitivity = useMemo(() => {
    return (mcRobustness.volatility_sensitivity || []).map((row) => ({
      ...row,
      median_ending_equity: Number(Number(row.median_ending_equity || 0).toFixed(2)),
      worst_5pct_ending_equity: Number(Number(row.worst_5pct_ending_equity || 0).toFixed(2)),
      median_max_drawdown: Math.abs(Number(Number(row.median_max_drawdown || 0).toFixed(2))),
    }));
  }, [mcRobustness]);

  const winRateSensitivity = useMemo(() => {
    return (mcRobustness.win_rate_sensitivity || []).map((row) => ({
      ...row,
      median_ending_equity: Number(Number(row.median_ending_equity || 0).toFixed(2)),
      worst_5pct_ending_equity: Number(Number(row.worst_5pct_ending_equity || 0).toFixed(2)),
      median_max_drawdown: Math.abs(Number(Number(row.median_max_drawdown || 0).toFixed(2))),
    }));
  }, [mcRobustness]);

  return (
    <>
      <section className="grid metrics">
        <MetricCard title="Net Profit" value={money(m.net_profit)} icon={DollarSign} tone="green" />
        <MetricCard title="Win Rate" value={pct(m.win_rate)} icon={TrendingUp} tone="blue" />
        <MetricCard title="Profit Factor" value={m.profit_factor ? Number(m.profit_factor).toFixed(2) : '—'} icon={Activity} tone="purple" />
        <MetricCard title="Max Drawdown" value={money(m.max_drawdown)} icon={ShieldAlert} tone="red" />
        <MetricCard title="Gross Profit" value={money(m.gross_profit)} icon={DollarSign} tone="green" />
        <MetricCard title="Gross Loss" value={money(m.gross_loss)} icon={DollarSign} tone="red" />
        <MetricCard title="Trades" value={m.total_trades} icon={Activity} tone="amber" />
        <MetricCard title="Expectancy" value={money(m.expectancy)} icon={TrendingUp} tone="blue" />
      </section>

      <section className="charts">
        <ChartCard title="Equity Curve" subtitle="Cumulative strategy PnL, rounded to 2 decimals.">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={equityCurve} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="time" hide />
              <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${chartNumber(value)}`, 'Equity']} labelFormatter={(label) => `Time: ${label}`} />
              <Line type="monotone" dataKey="equity" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Drawdown Curve" subtitle="Strategy drawdown from prior equity peak.">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={drawdownCurve} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="time" hide />
              <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${chartNumber(value)}`, 'Drawdown']} labelFormatter={(label) => `Time: ${label}`} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Line type="monotone" dataKey="drawdown" stroke="#dc2626" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="PnL Distribution by Trade" subtitle="Last 80 trades. Green bars are winners, red bars are losers.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={hist} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="trade" tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${chartNumber(value)}`, 'Trade PnL']} labelFormatter={(label) => `Trade #${label}`} />
              <ReferenceLine y={0} stroke="#64748b" />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                {hist.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.positive ? '#16a34a' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="card monteCarloCard">
        <div className="mcHeader">
          <div>
            <span className="badge miniBadge">Professional Monte Carlo</span>
            <h3>Unknown-Event Strategy Valuation</h3>
            <p>Bootstraps historical trade PnL into configurable random future paths. This focuses on survival, drawdown behavior, VaR/CVaR, and robustness instead of only average return.</p>
          </div>
          <div className="mcMeta">
            <strong>{mc.simulations || 0}</strong>
            <span>simulations</span>
          </div>
        </div>

        <div className="mcSectionTitle">Return Metrics</div>
        <div className="grid metrics mcMetrics">
          <MetricCard title="Median Ending Equity" value={money(mcSummary.median_ending_equity)} icon={DollarSign} tone="green" description="Middle outcome after all simulations. Half of paths end above this value and half below." />
          <MetricCard title="Mean Ending Equity" value={money(mcSummary.mean_ending_equity)} icon={DollarSign} tone="blue" description="Average ending balance across all simulated paths. Sensitive to very large winners or losers." />
          <MetricCard title="Median CAGR" value={pct(mcSummary.median_cagr_pct)} icon={TrendingUp} tone="green" description="Typical annualized growth rate from the simulations, based on the median path." />
          <MetricCard title="Win Probability" value={pct(mcSummary.win_probability_pct)} icon={Activity} tone="purple" description="Percentage of simulations that finished above the starting capital." />
        </div>

        <div className="mcSectionTitle">Risk Metrics</div>
        <div className="grid metrics mcMetrics">
          <MetricCard title="Median Max DD" value={money(mcSummary.median_max_drawdown)} icon={ShieldAlert} tone="red" description="Typical worst peak-to-trough loss experienced during a simulated path." />
          <MetricCard title="Worst 5% Max DD" value={money(mcSummary.p05_max_drawdown)} icon={ShieldAlert} tone="red" description="Severe drawdown threshold. Only the worst 5% of simulations had drawdowns this bad or worse." />
          <MetricCard title="Loss Probability" value={pct(mcSummary.loss_probability_pct)} icon={Activity} tone="amber" description="Percentage of simulations that ended below the starting capital." />
          <MetricCard title="30% Ruin Risk" value={pct(mcSummary.risk_of_30pct_ruin_pct)} icon={ShieldAlert} tone="purple" description="Percentage of paths that lost 30% or more from starting capital at any point." />
          <MetricCard title="VaR 95%" value={pct(mcSummary.var_95_pct)} icon={ShieldAlert} tone="red" description="Value at Risk. The loss level that only the worst 5% of simulations exceeded." />
          <MetricCard title="CVaR 95%" value={pct(mcSummary.cvar_95_pct)} icon={ShieldAlert} tone="red" description="Conditional VaR. Average loss inside the worst 5% of simulated outcomes." />
          <MetricCard title="Median DD Duration" value={`${chartNumber(mcSummary.median_drawdown_duration_trades)} trades`} icon={Activity} tone="blue" description="Typical number of trades the strategy stayed below its previous equity high." />
          <MetricCard title="95% Recovery Time" value={`${chartNumber(mcSummary.p95_recovery_time_trades)} trades`} icon={Activity} tone="amber" description="Stress recovery estimate. 95% of recoveries were faster than this many trades." />
        </div>

        <section className="charts mcCharts">
          <ChartCard title="Equity Curve Fan Chart" subtitle="5th, 25th, 50th, 75th and 95th percentile simulated equity paths.">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={fanChart} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="trade" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`$${chartNumber(value)}`, name]} labelFormatter={(label) => `Trade #${label}`} />
                <Line type="monotone" dataKey="p95" stroke="#93c5fd" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p75" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p50" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="p25" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p05" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Monte Carlo Sample Paths" subtitle="Three random future paths created by resampling historical trade outcomes.">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={mcPathChart} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="trade" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`$${chartNumber(value)}`, name]} labelFormatter={(label) => `Trade #${label}`} />
                <Line type="monotone" dataKey="Path 1" stroke="#2563eb" strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="Path 2" stroke="#16a34a" strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="Path 3" stroke="#7c3aed" strokeWidth={2.4} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Maximum Drawdown Distribution" subtitle="How deep simulated drawdowns became. Lower is better.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={mcDrawdownHist} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="bucketIndex" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Simulations']} labelFormatter={(label) => mcDrawdownHist[Number(label) - 1]?.bucket || `Bucket ${label}`} />
                <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Ending Equity Distribution" subtitle="How often each ending-equity range appeared across simulations.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={mcEndingHist} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="bucketIndex" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Simulations']} labelFormatter={(label) => mcEndingHist[Number(label) - 1]?.bucket || `Bucket ${label}`} />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="CAGR Distribution" subtitle="Annualized return range across Monte Carlo paths.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cagrHist} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="bucketIndex" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Simulations']} labelFormatter={(label) => cagrHist[Number(label) - 1]?.bucket || `Bucket ${label}`} />
                <Bar dataKey="count" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Drawdown Duration Distribution" subtitle="How long simulated paths stayed underwater, measured in trades.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={mcDurationHist} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="bucketIndex" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Simulations']} labelFormatter={(label) => mcDurationHist[Number(label) - 1]?.bucket || `Bucket ${label}`} />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Recovery Time Distribution" subtitle="Typical number of trades needed to recover from drawdowns.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={mcRecoveryHist} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="bucketIndex" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Simulations']} labelFormatter={(label) => mcRecoveryHist[Number(label) - 1]?.bucket || `Bucket ${label}`} />
                <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <div className="mcSectionTitle">Robustness Metrics</div>
        <section className="charts mcCharts">
          <ChartCard title="Sensitivity to Volatility" subtitle="Median ending equity under lower/higher trade PnL volatility.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={volatilitySensitivity} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="scenario" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === 'median_max_drawdown' ? `$${chartNumber(value)}` : `$${chartNumber(value)}`, name]} />
                <Bar dataKey="median_ending_equity" name="Median Ending Equity" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="worst_5pct_ending_equity" name="Worst 5% Ending Equity" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Sensitivity to Win Rate" subtitle="Stress test when the historical win rate improves or degrades.">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={winRateSensitivity} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="scenario" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tickFormatter={moneyAxis} tick={{ fill: '#475569', fontSize: 12 }} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`$${chartNumber(value)}`, name]} />
                <Bar dataKey="median_ending_equity" name="Median Ending Equity" fill="#16a34a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="worst_5pct_ending_equity" name="Worst 5% Ending Equity" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <div className="tablewrap mcTable">
          <table>
            <thead>
              <tr>
                <th>Sequence Stress Test</th>
                <th>Ending Equity</th>
                <th>CAGR</th>
                <th>Max Drawdown</th>
                <th>Max DD %</th>
                <th>DD Duration</th>
                <th>Recovery Time</th>
              </tr>
            </thead>
            <tbody>
              {(mcRobustness.sequence_stress_tests || []).map((row) => (
                <tr key={row.scenario}>
                  <td>{row.scenario}</td>
                  <td>{money(row.ending_equity)}</td>
                  <td>{pct(row.cagr_pct)}</td>
                  <td>{money(row.max_drawdown)}</td>
                  <td>{pct(row.max_drawdown_pct)}</td>
                  <td>{row.max_drawdown_duration_trades} trades</td>
                  <td>{row.avg_recovery_time_trades} trades</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card tablecard">
        <h3>Trade Log</h3>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>{['entry_time', 'exit_time', 'side', 'entry_price', 'exit_price', 'pnl', 'bars_held', 'exit_reason'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(data.trades || []).slice(-30).reverse().map((t, i) => (
                <tr key={i}>
                  {['entry_time', 'exit_time', 'side', 'entry_price', 'exit_price', 'pnl', 'bars_held', 'exit_reason'].map((h) => {
                    const value = ['entry_price', 'exit_price', 'pnl'].includes(h) ? Number(t[h]).toFixed(2) : t[h];
                    return <td key={h}>{value}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function App() {
  const [strategies, setStrategies] = useState([]);
  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_PRESETS_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [strategy, setStrategy] = useState('goat_stop_breakout');
  const [mode, setMode] = useState('preset');
  const [custom, setCustom] = useState(defaultCustom);
  const [advancedFile, setAdvancedFile] = useState(null);
  const [mcSimulations, setMcSimulations] = useState(1000);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/strategies`).then((r) => r.json()).then(setStrategies).catch(() => setError('Backend is not reachable. Start FastAPI on port 8000.'));
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  const presetOptions = useMemo(() => [
    ...strategies.map((s) => ({ ...s, source: 'system' })),
    ...savedPresets.map((s) => ({
      key: s.key,
      label: `${s.label} · Custom`,
      description: s.description || 'Saved from Custom Builder.',
      source: 'custom',
      config: s.config,
    })),
  ], [strategies, savedPresets]);

  const selectedStrategy = presetOptions.find((s) => s.key === strategy);

  useEffect(() => {
    if (!presetOptions.length) return;
    if (!presetOptions.some((s) => s.key === strategy)) {
      setStrategy(presetOptions[0].key);
    }
  }, [presetOptions, strategy]);

  useEffect(() => {
    if (mode !== 'preset' || !selectedStrategy) return;
    setLoading(true);
    setError('');

    const request = selectedStrategy.source === 'custom'
      ? fetch(`${API}/custom-backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...selectedStrategy.config,
            length: Number(selectedStrategy.config.length),
            fast: Number(selectedStrategy.config.fast),
            slow: Number(selectedStrategy.config.slow),
            vol_length: Number(selectedStrategy.config.vol_length),
            exit_bars: Number(selectedStrategy.config.exit_bars),
            monte_carlo_simulations: Number(mcSimulations) || 1000,
          }),
        })
      : fetch(`${API}/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy, monte_carlo_simulations: Number(mcSimulations) || 1000 }),
        });

    request
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then(setData)
      .catch(() => setError('Backtest failed. Check the backend terminal for the error.'))
      .finally(() => setLoading(false));
  }, [strategy, mode, mcSimulations, selectedStrategy]);

  const runCustom = (event) => {
    event.preventDefault();
    setMode('custom');
    setLoading(true);
    setError('');
    fetch(`${API}/custom-backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...custom,
        length: Number(custom.length),
        fast: Number(custom.fast),
        slow: Number(custom.slow),
        vol_length: Number(custom.vol_length),
        exit_bars: Number(custom.exit_bars),
        monte_carlo_simulations: Number(mcSimulations) || 1000,
      }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then(setData)
      .catch(() => setError('Custom backtest failed. Please check the selected parameters.'))
      .finally(() => setLoading(false));
  };

  const runAdvanced = (event) => {
    event.preventDefault();
    if (!advancedFile) {
      setError('Please choose a Python .py strategy file first.');
      return;
    }
    setMode('advanced');
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', advancedFile);
    formData.append('initial_capital', '10000');
    formData.append('lot_size', '1');
    formData.append('contract_multiplier', '100');
    formData.append('commission_per_trade', '2');
    formData.append('slippage_points', '0.10');
    formData.append('monte_carlo_simulations', String(Number(mcSimulations) || 1000));

    fetch(`${API}/advanced-backtest`, {
      method: 'POST',
      body: formData,
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Advanced backtest failed.');
      })
      .then(setData)
      .catch((err) => setError(err.message || 'Advanced backtest failed. Please check your Python strategy file.'))
      .finally(() => setLoading(false));
  };

  const saveCustomToPreset = () => {
    const cleanName = (custom.name || 'My Custom Strategy').trim();
    const key = `custom_${Date.now()}`;
    const config = {
      ...custom,
      name: cleanName,
      length: Number(custom.length),
      fast: Number(custom.fast),
      slow: Number(custom.slow),
      vol_length: Number(custom.vol_length),
      exit_bars: Number(custom.exit_bars),
    };

    const newPreset = {
      key,
      label: cleanName,
      description: `${entryOptions.find(([value]) => value === custom.entry_type)?.[1] || custom.entry_type} · ${custom.direction.replace('_', ' ')} · exit after ${custom.exit_bars} bars`,
      config,
      created_at: new Date().toISOString(),
    };

    setSavedPresets((prev) => [...prev, newPreset]);
    setStrategy(key);
    setMode('preset');
    setError('');
  };

  const removeSelectedPreset = () => {
    if (!selectedStrategy || selectedStrategy.source !== 'custom') return;
    setSavedPresets((prev) => prev.filter((item) => item.key !== selectedStrategy.key));
    setStrategy(strategies[0]?.key || 'goat_stop_breakout');
  };

  const updateCustom = (key, value) => setCustom((prev) => ({ ...prev, [key]: value }));
  const updateMcSimulations = (value) => {
    const numeric = Math.max(100, Math.min(50000, Number(value) || 1000));
    setMcSimulations(numeric);
  };

  const MonteCarloInput = () => (
    <Field label="Monte Carlo Simulations">
      <input
        type="number"
        min="100"
        max="50000"
        step="100"
        value={mcSimulations}
        onChange={(e) => updateMcSimulations(e.target.value)}
      />
      <small>Use 1,000 for speed, 10,000 for stronger research. The dashboard still renders optimized percentile bands.</small>
    </Field>
  );

  return (
    <main>
      <section className="hero">
        <div>
          <span className="badge">XAUUSD Algo Trading Lab</span>
          <h1>Build, test and compare XAUUSD strategies</h1>
          <p>
            Use preset Peak-style systems or create your own strategy rules. The dashboard automatically calculates equity, drawdown, PnL distribution, profit factor, win rate and trade logs.
          </p>
          <div className="tabs">
            <button className={mode === 'preset' ? 'active' : ''} onClick={() => setMode('preset')}><Activity size={17} /> Preset Strategies</button>
            <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}><SlidersHorizontal size={17} /> Custom Builder</button>
            <button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}><Code2 size={17} /> Advanced Mode</button>
          </div>
        </div>

        {mode === 'preset' && (
          <div className="control">
            <label>Strategy</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              {strategies.length > 0 && <optgroup label="Built-in Presets">
                {strategies.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </optgroup>}
              {savedPresets.length > 0 && <optgroup label="Saved Custom Presets">
                {savedPresets.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </optgroup>}
            </select>
            <MonteCarloInput />
            <div className="presetActions">
              <small>{selectedStrategy?.description || 'Choose a strategy to backtest.'}</small>
              {selectedStrategy?.source === 'custom' && (
                <button type="button" className="removePresetBtn" onClick={removeSelectedPreset}>
                  <Trash2 size={16} /> Remove from Presets
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <form className="control customPanel" onSubmit={runCustom}>
            <Field label="Strategy Name">
              <input value={custom.name} onChange={(e) => updateCustom('name', e.target.value)} />
            </Field>
            <Field label="Entry Type">
              <select value={custom.entry_type} onChange={(e) => updateCustom('entry_type', e.target.value)}>
                {entryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <div className="formGrid">
              <Field label="Direction">
                <select value={custom.direction} onChange={(e) => updateCustom('direction', e.target.value)}>
                  <option value="long_short">Long & Short</option>
                  <option value="long_only">Long Only</option>
                  <option value="short_only">Short Only</option>
                </select>
              </Field>
              <Field label="Length">
                <input type="number" min="2" value={custom.length} onChange={(e) => updateCustom('length', e.target.value)} />
              </Field>
              <Field label="Fast Length">
                <input type="number" min="2" value={custom.fast} onChange={(e) => updateCustom('fast', e.target.value)} />
              </Field>
              <Field label="Slow Length">
                <input type="number" min="3" value={custom.slow} onChange={(e) => updateCustom('slow', e.target.value)} />
              </Field>
              <Field label="Volume Length">
                <input type="number" min="2" value={custom.vol_length} onChange={(e) => updateCustom('vol_length', e.target.value)} />
              </Field>
              <Field label="Exit Bars">
                <input type="number" min="1" value={custom.exit_bars} onChange={(e) => updateCustom('exit_bars', e.target.value)} />
              </Field>
            </div>
            <div className="formGrid two">
              <Field label="Trend Filter">
                <select value={custom.trend_filter} onChange={(e) => updateCustom('trend_filter', e.target.value)}>
                  <option value="none">None</option>
                  <option value="with_ema_200">With 200 EMA Trend</option>
                  <option value="against_ema_200">Against 200 EMA Trend</option>
                </select>
              </Field>
              <Field label="Session Filter">
                <select value={custom.session_filter} onChange={(e) => updateCustom('session_filter', e.target.value)}>
                  <option value="all">All Sessions</option>
                  <option value="london">London</option>
                  <option value="new_york">New York</option>
                  <option value="london_new_york">London + New York</option>
                </select>
              </Field>
            </div>
            <MonteCarloInput />
            <div className="customActions">
              <button className="runBtn" type="submit"><PlayCircle size={18} /> Run Custom Backtest</button>
              <button className="savePresetBtn" type="button" onClick={saveCustomToPreset}><Save size={18} /> Save to Presets</button>
            </div>
          </form>
        )}

        {mode === 'advanced' && (
          <form className="control advancedPanel" onSubmit={runAdvanced}>
            <div className="advancedIcon"><UploadCloud size={24} /></div>
            <h3>Upload Python Strategy</h3>
            <p>Advanced Mode runs a local Python strategy file and displays the same metrics dashboard.</p>
            <div className="contractBox">
              <strong>Required contract</strong>
              <code>generate_signals(df)</code>
              <span>Return 1 for long, -1 for short, 0 for flat.</span>
            </div>
            <MonteCarloInput />
            <input
              className="fileInput"
              type="file"
              accept=".py"
              onChange={(e) => setAdvancedFile(e.target.files?.[0] || null)}
            />
            {advancedFile && <small>Selected: {advancedFile.name}</small>}
            <button className="runBtn advancedRun" type="submit"><PlayCircle size={18} /> Run Python Strategy</button>
          </form>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Running backtest...</p>}
      {data && <Dashboard data={data} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
