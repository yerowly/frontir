import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../theme";
import { STRATS } from "../data";
import TickerLogo from "../TickerLogo";
import API from "../api";

const STRAT_COLORS = {
  max_sharpe:  "#2dd4a0",
  min_var:     "#60a5fa",
  risk_parity: "#f59e0b",
  max_return:  "#f0506e",
  equal:       "#e879a8",
};

function today() { return new Date().toISOString().slice(0, 10); }

function calcDrawdown(values) {
  if (!values || values.length === 0) return [];
  let peak = values[0];
  return values.map(v => {
    if (v > peak) peak = v;
    return peak > 0 ? ((v - peak) / peak) * 100 : 0;
  });
}


function MultiLineChart({ series, loading }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [tip, setTip] = useState(null);
  const [cw, setCw]   = useState(700);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current; if (!cv) return;
    const W = cw, H = 280, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!series || series.length === 0) {
      ctx.fillStyle = C.textDim; ctx.font = `400 12px ${FONT}`; ctx.textAlign = "center";
      ctx.fillText(loading ? "Running backtest…" : "Run a backtest to see results", W / 2, H / 2);
      return;
    }

    
    const norm = series.map(s => ({
      ...s,
      pct: s.values.map(v => s.values[0] > 0 ? ((v / s.values[0]) - 1) * 100 : 0),
    }));

    const allPct = norm.flatMap(s => s.pct);
    const mn  = Math.min(...allPct, 0);
    const mx  = Math.max(...allPct, 0);
    const pad_mn = mn < 0 ? mn * 1.08 : -2;
    const pad_mx = mx > 0 ? mx * 1.08 :  2;
    const len = series[0].values.length;

    const pad = { t: 14, r: 14, b: 30, l: 58 };
    const iw  = W - pad.l - pad.r;
    const ih  = H - pad.t - pad.b;
    const tx  = i => pad.l + (i / (len - 1)) * iw;
    const ty  = v => pad.t + (1 - (v - pad_mn) / (pad_mx - pad_mn)) * ih;

    // Grid
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = pad_mn + ((pad_mx - pad_mn) / ticks) * i;
      const y = ty(v);
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "right";
      ctx.fillText(`${v >= 0 ? "+" : ""}${v.toFixed(0)}%`, pad.l - 5, y + 3);
    }

    // Zero line
    const zy = ty(0);
    if (zy > pad.t && zy < H - pad.b) {
      ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, zy); ctx.lineTo(W - pad.r, zy); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Lines
    for (const s of norm) {
      ctx.beginPath();
      s.pct.forEach((v, i) => i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v)));
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      ctx.shadowColor = s.color + "55"; ctx.shadowBlur = 6;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // X-axis date labels
    if (series[0].dates?.length > 0) {
      const dates = series[0].dates;
      const step  = Math.max(1, Math.floor(len / 7));
      ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "center";
      for (let i = 0; i < len; i += step) {
        ctx.fillText(dates[i].slice(0, 7), tx(i), H - 6);
      }
    }

    // Crosshair + dots
    if (tip !== null && tip >= 0 && tip < len) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(tx(tip), pad.t); ctx.lineTo(tx(tip), H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      for (const s of norm) {
        ctx.beginPath(); ctx.arc(tx(tip), ty(s.pct[tip]), 4, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }
    }
  }, [series, cw, tip, loading]);

  const onMove = e => {
    if (!series?.length) return;
    const r   = cRef.current.getBoundingClientRect();
    const len = series[0].values.length;
    const idx = Math.round(((e.clientX - r.left - 58) / (r.width - 58 - 14)) * (len - 1));
    if (idx >= 0 && idx < len) setTip(idx);
  };

  // Recompute for tooltip (cheap, runs in render)
  const tipNorm = series
    ? series.map(s => ({
        label: s.label, color: s.color,
        pct: s.values[0] > 0 && tip !== null ? ((s.values[tip] / s.values[0]) - 1) * 100 : 0,
      }))
    : [];

  return (
    <div ref={wRef} style={{ position: "relative", width: "100%" }}>
      <canvas ref={cRef} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ cursor: "crosshair", width: "100%", display: "block" }} />
      {tip !== null && series?.length > 0 && (
        <div style={{
          position: "absolute", top: 8,
          left: Math.min((tip / (series[0].values.length - 1)) * (cw - 72) + 58, cw - 176),
          background: C.surface, border: `1px solid ${C.borderHover}`, borderRadius: 8,
          padding: "8px 12px", pointerEvents: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          minWidth: 164, zIndex: 10,
        }}>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT, marginBottom: 6 }}>
            {series[0].dates[tip]}
          </div>
          {tipNorm.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: C.textDim, fontFamily: FONT }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color, fontFamily: FONT }}>
                {s.pct >= 0 ? "+" : ""}{s.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Drawdown chart ──────────────────────────────────────────────────────────
function DrawdownChart({ values, dates, color = C.red }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [tip, setTip] = useState(null);
  const [cw, setCw]   = useState(400);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current; if (!cv) return;
    const W = cw, H = 200, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!values || values.length < 2) {
      ctx.fillStyle = C.textDim; ctx.font = `400 12px ${FONT}`; ctx.textAlign = "center";
      ctx.fillText("No data", W / 2, H / 2);
      return;
    }

    const mn  = Math.min(...values) * 1.08;
    const len = values.length;
    const pad = { t: 10, r: 14, b: 28, l: 52 };
    const iw  = W - pad.l - pad.r;
    const ih  = H - pad.t - pad.b;
    const tx  = i => pad.l + (i / (len - 1)) * iw;
    const ty  = v => pad.t + (1 - (v - mn) / (0 - mn)) * ih;

    // Grid
    for (let i = 0; i <= 4; i++) {
      const v = (mn / 4) * i;
      const y = ty(v);
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "right";
      ctx.fillText(`${v.toFixed(0)}%`, pad.l - 4, y + 3);
    }

    // Fill
    const g = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    g.addColorStop(0, `${C.red}30`); g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(tx(0), ty(0));
    values.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(len - 1), ty(0));
    ctx.fillStyle = g; ctx.fill();

    // Line
    ctx.beginPath();
    values.forEach((v, i) => i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v)));
    ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.stroke();

    // X-axis date labels
    if (dates?.length > 0) {
      const step = Math.max(1, Math.floor(len / 6));
      ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "center";
      for (let i = 0; i < len; i += step) {
        ctx.fillText(dates[i].slice(0, 7), tx(i), H - 6);
      }
    }

    // Crosshair
    if (tip !== null && tip >= 0 && tip < len) {
      ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(tx(tip), pad.t); ctx.lineTo(tx(tip), H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(tx(tip), ty(values[tip]), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = C.red; ctx.shadowColor = C.red; ctx.shadowBlur = 6;
      ctx.fill(); ctx.shadowBlur = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, cw, tip, color]);

  const onMove = e => {
    if (!values?.length) return;
    const r   = cRef.current.getBoundingClientRect();
    const idx = Math.round(((e.clientX - r.left - 52) / (r.width - 52 - 14)) * (values.length - 1));
    if (idx >= 0 && idx < values.length) setTip(idx);
  };

  return (
    <div ref={wRef} style={{ position: "relative", width: "100%" }}>
      <canvas ref={cRef} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ cursor: "crosshair", width: "100%", display: "block" }} />
      {tip !== null && values?.length > 0 && (
        <div style={{
          position: "absolute", top: 4,
          left: Math.min((tip / (values.length - 1)) * (cw - 66) + 52, cw - 128),
          background: C.surface, border: `1px solid ${C.borderHover}`, borderRadius: 7,
          padding: "6px 10px", pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          zIndex: 10,
        }}>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>{dates?.[tip]}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.red, fontFamily: FONT }}>
            {values[tip].toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BacktestPage({ holdings = [], onAdd }) {
  const [startDate,    setStartDate]    = useState("2020-01-01");
  const [endDate,      setEndDate]      = useState(today());
  const [trainMonths,  setTrainMonths]  = useState(12);
  const [rebalMonths,  setRebalMonths]  = useState(1);
  const [commission,   setCommission]   = useState(0.10);   // shown as %
  const [loading,      setLoading]      = useState(false);
  const [results,      setResults]      = useState(null);
  const [error,        setError]        = useState(null);
  const [selStrat,     setSelStrat]     = useState("max_sharpe");

  async function runBacktest() {
    const tickers = holdings.map(h => h.ticker);
    if (tickers.length < 2) { setError("Add at least 2 tickers to run a backtest."); return; }
    setLoading(true); setError(null); setResults(null);
    try {
      const res = await fetch(`${API}/api/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers,
          start: startDate,
          end:   endDate,
          train_months:     trainMonths,
          rebalance_months: rebalMonths,
          commission:       commission / 100,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
      const data = await res.json();
      setResults(data.results);
      if (data.results.length > 0) setSelStrat(data.results[0].strategy);
    } catch (e) {
      setError(e.message || "Backtest failed — check the API server.");
    }
    setLoading(false);
  }

  const chartSeries = results
    ? results.map(r => ({
        label:  STRATS.find(s => s.id === r.strategy)?.name ?? r.strategy,
        color:  STRAT_COLORS[r.strategy] ?? C.accent,
        dates:  r.cumulative.dates,
        values: r.cumulative.values,
      }))
    : [];

  const selResult  = results?.find(r => r.strategy === selStrat);
  const ddValues   = selResult ? calcDrawdown(selResult.cumulative.values) : [];
  const ddDates    = selResult?.cumulative.dates ?? [];

  const bx = (extra = {}) => ({
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...extra,
  });
  const lbl = text => (
    <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em",
      textTransform: "uppercase", marginBottom: 16, fontFamily: FONT }}>{text}</div>
  );
  const inp = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 12px", color: C.text, fontFamily: FONT, fontSize: 13,
    outline: "none", transition: "border-color 0.2s", colorScheme: "dark",
  };

  return (
    <div style={{ padding: "20px 28px 40px", fontFamily: FONT }}>
      <style>{`
        .bt-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; border-radius: 2px;
          background: rgba(45,212,160,0.15); cursor: pointer; outline: none;
        }
        .bt-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: #2dd4a0; cursor: pointer;
          box-shadow: 0 0 0 3px rgba(45,212,160,0.15);
        }
        .bt-range::-moz-range-thumb {
          width: 14px; height: 14px; border: none; border-radius: 50%;
          background: #2dd4a0; cursor: pointer;
        }
        .bt-range::-webkit-slider-runnable-track { border-radius: 2px; }
        @keyframes bt-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── CONFIGURATION ───────────────────────────────────────────────── */}
      <div style={{ ...bx(), marginBottom: 16 }}>
        {lbl("Configuration")}

        {/* Ticker chips from shared portfolio */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.textDim, fontFamily: FONT, marginBottom: 8 }}>
            Tickers <span style={{ color: C.textFaint }}>({holdings.length})</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {holdings.map(h => (
              <div key={h.ticker} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: C.accentDim, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: "3px 8px",
                fontSize: 12, fontWeight: 600, color: C.text, fontFamily: FONT,
              }}>
                <TickerLogo ticker={h.ticker} size={16} />
                <span>{h.ticker}</span>
              </div>
            ))}
            <button onClick={onAdd} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "transparent", border: `1px dashed ${C.border}`,
              borderRadius: 6, padding: "3px 10px",
              fontSize: 12, color: C.textDim, fontFamily: FONT, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}>
              + Add position
            </button>
          </div>
        </div>

        {/* Date range + sliders in one responsive grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
          {/* Start date */}
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6, fontFamily: FONT }}>Start date</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ ...inp, width: "100%", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border} />
          </div>

          {/* End date */}
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6, fontFamily: FONT }}>End date</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ ...inp, width: "100%", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border} />
          </div>

          {/* Train window */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Train window</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: FONT }}>{trainMonths} mo</span>
            </div>
            <input type="range" className="bt-range" min={3} max={60} step={1} value={trainMonths}
              onChange={e => setTrainMonths(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>3mo</span>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>60mo</span>
            </div>
          </div>

          {/* Rebalance */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Rebalance</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: FONT }}>{rebalMonths} mo</span>
            </div>
            <input type="range" className="bt-range" min={1} max={12} step={1} value={rebalMonths}
              onChange={e => setRebalMonths(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>1mo</span>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>12mo</span>
            </div>
          </div>

          {/* Commission */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Commission</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: FONT }}>{commission.toFixed(2)}%</span>
            </div>
            <input type="range" className="bt-range" min={0} max={0.5} step={0.05} value={commission}
              onChange={e => setCommission(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>0%</span>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>0.5%</span>
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runBacktest}
          disabled={loading || holdings.length < 2}
          style={{
            padding: "11px 32px", background: C.accent, border: "none", borderRadius: 8,
            color: "#0b0b12", fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: loading || holdings.length < 2 ? "not-allowed" : "pointer",
            opacity: loading || holdings.length < 2 ? 0.65 : 1,
            boxShadow: `0 2px 16px ${C.accentGlow}`,
            transition: "opacity 0.2s, box-shadow 0.2s",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 4px 24px rgba(45,212,160,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 16px ${C.accentGlow}`; }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>↻</span>
          {loading ? "Running…" : "Run Backtest"}
        </button>
      </div>

      {/* ── ERROR ───────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: C.redDim, border: `1px solid rgba(240,80,110,0.3)`,
          borderRadius: 10, padding: "12px 18px", marginBottom: 16,
          color: C.red, fontFamily: FONT, fontSize: 13,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── LOADING ─────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ ...bx(), display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, padding: "48px 0", marginBottom: 16 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.accent}`,
            animation: "bt-spin 0.75s linear infinite",
          }} />
          <span style={{ color: C.textDim, fontFamily: FONT, fontSize: 13 }}>
            Running walk-forward backtest — this may take a few seconds…
          </span>
        </div>
      )}

      {/* ── RESULTS TABLE ───────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <div style={{ ...bx(), marginBottom: 16 }}>
          {lbl("Results")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Strategy", "Ann. Return", "Volatility", "Sharpe", "Max Drawdown", "Total Commission"].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: "7px 14px",
                    fontSize: 11, color: C.textDim, fontWeight: 500,
                    borderBottom: `1px solid ${C.border}`, fontFamily: FONT,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(r => {
                const sel    = r.strategy === selStrat;
                const name   = STRATS.find(s => s.id === r.strategy)?.name ?? r.strategy;
                const color  = STRAT_COLORS[r.strategy] ?? C.accent;
                return (
                  <tr key={r.strategy} onClick={() => setSelStrat(r.strategy)} style={{
                    cursor: "pointer",
                    background: sel ? C.accentDim : "transparent",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = C.surfaceHover; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3,
                          background: color, flexShrink: 0, boxShadow: sel ? `0 0 6px ${color}55` : "none" }} />
                        <span style={{
                          fontSize: 13, fontWeight: sel ? 600 : 500,
                          color: sel ? C.text : C.textMid, fontFamily: FONT,
                        }}>{name}</span>
                        {sel && (
                          <span style={{ fontSize: 10, color: color, fontFamily: FONT,
                            background: `${color}18`, padding: "2px 6px", borderRadius: 4 }}>
                            selected
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right",
                      borderBottom: `1px solid ${C.border}`, fontFamily: FONT,
                      color: r.annual_return >= 0 ? C.green : C.red, fontWeight: 600 }}>
                      {r.annual_return >= 0 ? "+" : ""}{(r.annual_return * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right",
                      borderBottom: `1px solid ${C.border}`, color: C.textMid, fontFamily: FONT }}>
                      {(r.volatility * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right",
                      borderBottom: `1px solid ${C.border}`, color: C.accent,
                      fontWeight: 600, fontFamily: FONT }}>
                      {r.sharpe.toFixed(3)}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right",
                      borderBottom: `1px solid ${C.border}`, color: C.red, fontFamily: FONT }}>
                      {(r.max_drawdown * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right",
                      borderBottom: `1px solid ${C.border}`, color: C.textDim, fontFamily: FONT }}>
                      {(r.total_commission * 100).toFixed(3)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CHARTS ──────────────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>

          {/* Cumulative returns */}
          <div style={bx()}>
            {lbl("Cumulative Returns")}
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 14 }}>
              {chartSeries.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 18, height: 3, background: s.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>{s.label}</span>
                </div>
              ))}
            </div>
            <MultiLineChart series={chartSeries} loading={loading} />
          </div>

          {/* Drawdown */}
          <div style={bx()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              {lbl("Drawdown")}
              <span style={{ fontSize: 11, color: STRAT_COLORS[selStrat] ?? C.accent,
                fontFamily: FONT, fontWeight: 500, marginTop: -12, marginBottom: 14 }}>
                {STRATS.find(s => s.id === selStrat)?.name ?? selStrat}
              </span>
            </div>
            {/* Strategy picker for drawdown */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {results.map(r => {
                const c = STRAT_COLORS[r.strategy] ?? C.accent;
                const a = r.strategy === selStrat;
                return (
                  <button key={r.strategy} onClick={() => setSelStrat(r.strategy)} style={{
                    padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontFamily: FONT,
                    fontSize: 11, fontWeight: a ? 600 : 400,
                    background: a ? `${c}18` : "transparent",
                    border: `1px solid ${a ? c : C.border}`,
                    color: a ? c : C.textDim,
                    transition: "all 0.15s",
                  }}>
                    {STRATS.find(s => s.id === r.strategy)?.name ?? r.strategy}
                  </button>
                );
              })}
            </div>
            <DrawdownChart values={ddValues} dates={ddDates} color={STRAT_COLORS[selStrat]} />
            {selResult && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                <div style={{ background: C.redDim, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT, marginBottom: 4 }}>
                    Max Drawdown
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.red, fontFamily: FONT }}>
                    {(selResult.max_drawdown * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ background: C.accentDim, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT, marginBottom: 4 }}>
                    Ann. Return
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700,
                    color: selResult.annual_return >= 0 ? C.green : C.red, fontFamily: FONT }}>
                    {selResult.annual_return >= 0 ? "+" : ""}{(selResult.annual_return * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
