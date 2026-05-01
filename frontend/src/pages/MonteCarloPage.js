import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../theme";
import TickerLogo from "../TickerLogo";
import API from "../api";

const STRAT_LABELS = {
  max_sharpe:  "Max Sharpe",
  min_var:     "Min Variance",
  risk_parity: "Risk Parity",
  max_return:  "Max Return",
  equal:       "Equal Weight",
};

const STRAT_COLORS = {
  max_sharpe:  "#2dd4a0",
  min_var:     "#60a5fa",
  risk_parity: "#f59e0b",
  max_return:  "#f0506e",
  equal:       "#e879a8",
};

const PERC_LINES = [
  { key: "95", label: "95th",   color: "#a78bfa", width: 1.5 },
  { key: "75", label: "75th",   color: "#60a5fa", width: 1.5 },
  { key: "50", label: "Median", color: "#2dd4a0", width: 2.5 },
  { key: "25", label: "25th",   color: "#f59e0b", width: 1.5 },
  { key: "5",  label: "5th",    color: "#f0506e", width: 1.5 },
];

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDollar(v) {
  return "$" + Math.round(v).toLocaleString("en");
}

function fmtDays(d) {
  const mo = Math.round(d / 21);
  if (mo < 12) return `${mo} mo`;
  const yr = mo / 12;
  return Number.isInteger(yr) ? `${yr} yr` : `${yr.toFixed(1)} yr`;
}

// ─── Percentile paths chart ────────────────────────────────────────────────
function PercentileChart({ data, initialInvestment }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [cw, setCw] = useState(800);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current;
    if (!cv || !data) return;

    const W = cw, H = 320, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const p5  = data["5"];
    const p25 = data["25"];
    const p50 = data["50"];
    const p75 = data["75"];
    const p95 = data["95"];
    const n   = p50.length;

    const allVals = [...p5, ...p95, initialInvestment];
    const rawMin  = Math.min(...allVals);
    const rawMax  = Math.max(...allVals);
    const span    = rawMax - rawMin || 1;
    const minV    = rawMin - span * 0.04;
    const maxV    = rawMax + span * 0.04;

    const pad = { t: 20, r: 20, b: 34, l: 76 };
    const iw  = W - pad.l - pad.r;
    const ih  = H - pad.t - pad.b;
    const tx  = i => pad.l + (i / (n - 1)) * iw;
    const ty  = v => pad.t + (1 - (v - minV) / (maxV - minV)) * ih;

    // Grid + Y-axis labels
    const ticks = 5;
    for (let g = 0; g <= ticks; g++) {
      const v = minV + ((maxV - minV) / ticks) * g;
      const y = ty(v);
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "right";
      const lab = v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${Math.round(v)}`;
      ctx.fillText(lab, pad.l - 5, y + 3);
    }

    // 25–75 band fill
    ctx.beginPath();
    p25.forEach((v, i) => i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v)));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(tx(i), ty(p75[i]));
    ctx.closePath();
    ctx.fillStyle = "rgba(45,212,160,0.07)";
    ctx.fill();

    // Dashed initial-investment baseline
    const iy = ty(initialInvestment);
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, iy); ctx.lineTo(W - pad.r, iy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = `400 9px ${FONT}`; ctx.textAlign = "left";
    ctx.fillText("Initial", pad.l + 4, iy - 4);

    // Percentile lines
    for (const line of PERC_LINES) {
      const vals = data[line.key];
      ctx.beginPath();
      vals.forEach((v, i) => i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v)));
      ctx.strokeStyle  = line.color;
      ctx.lineWidth    = line.width;
      ctx.shadowColor  = line.key === "50" ? line.color + "66" : "transparent";
      ctx.shadowBlur   = line.key === "50" ? 8 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // X-axis month labels
    const step = Math.max(1, Math.floor(n / 7));
    ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "center";
    for (let i = 0; i < n; i += step) {
      const mo = Math.round(i / 21);
      ctx.fillText(mo === 0 ? "Now" : `${mo}mo`, tx(i), H - 6);
    }

    // Crosshair + dots
    if (tip !== null && tip >= 0 && tip < n) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(tx(tip), pad.t); ctx.lineTo(tx(tip), H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      for (const line of PERC_LINES) {
        ctx.beginPath();
        ctx.arc(tx(tip), ty(data[line.key][tip]), 3.5, 0, Math.PI * 2);
        ctx.fillStyle   = line.color;
        ctx.shadowColor = line.color;
        ctx.shadowBlur  = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [data, cw, tip, initialInvestment]);

  const onMove = e => {
    if (!data) return;
    const r   = cRef.current.getBoundingClientRect();
    const n   = data["50"].length;
    const idx = Math.round(((e.clientX - r.left - 76) / (r.width - 96)) * (n - 1));
    if (idx >= 0 && idx < n) setTip(idx);
  };

  return (
    <div ref={wRef} style={{ position: "relative", width: "100%" }}>
      <canvas ref={cRef} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ cursor: "crosshair", width: "100%", display: "block" }} />
      {tip !== null && data && (
        <div style={{
          position: "absolute", top: 8,
          left: Math.min((tip / (data["50"].length - 1)) * (cw - 96) + 76, cw - 180),
          background: C.surface, border: `1px solid ${C.borderHover}`, borderRadius: 8,
          padding: "8px 12px", pointerEvents: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          minWidth: 170, zIndex: 10,
        }}>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT, marginBottom: 6 }}>
            {tip === 0 ? "Start" : `Day ${tip} · ${fmtDays(tip)}`}
          </div>
          {PERC_LINES.map(line => (
            <div key={line.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: line.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: C.textDim, fontFamily: FONT }}>{line.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: line.color, fontFamily: FONT }}>
                {fmtDollar(data[line.key][tip])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Distribution histogram ────────────────────────────────────────────────
function DistributionHistogram({ histogram, initialInvestment, median }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [cw, setCw] = useState(800);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current;
    if (!cv || !histogram) return;

    const W = cw, H = 220, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const { counts, edges } = histogram;
    const maxCount = Math.max(...counts);
    const pad = { t: 16, r: 20, b: 32, l: 16 };
    const iw  = W - pad.l - pad.r;
    const ih  = H - pad.t - pad.b;
    const n   = counts.length;
    const barW = iw / n;

    const xScale = v => pad.l + ((v - edges[0]) / (edges[edges.length - 1] - edges[0])) * iw;
    const yScale = c => pad.t + ih - (c / maxCount) * ih;

    // bars
    counts.forEach((count, i) => {
      const x   = pad.l + i * barW;
      const bh  = (count / maxCount) * ih;
      const mid = (edges[i] + edges[i + 1]) / 2;
      ctx.fillStyle = mid >= initialInvestment ? "rgba(45,212,160,0.55)" : "rgba(240,80,110,0.55)";
      ctx.fillRect(x + 0.5, yScale(count), barW - 1, bh);
    });

    // median vertical line
    const mx = xScale(median);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(mx, pad.t); ctx.lineTo(mx, H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.accent; ctx.font = `500 10px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText("Median", mx, pad.t - 3);

    // initial investment vertical line
    const ix = xScale(initialInvestment);
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(ix, pad.t); ctx.lineTo(ix, H - pad.b); ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "center";
    const labelStep = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i <= n; i += labelStep) {
      const v = edges[Math.min(i, edges.length - 1)];
      const x = pad.l + (i / n) * iw;
      const lab = v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${Math.round(v)}`;
      ctx.fillText(lab, x, H - 4);
    }
  }, [histogram, cw, initialInvestment, median]);

  return (
    <div ref={wRef} style={{ width: "100%" }}>
      <canvas ref={cRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function MonteCarloPage({ holdings = [] }) {
  const [strategy,     setStrategy]     = useState("max_sharpe");
  const [simDays,      setSimDays]      = useState(252);
  const [numSims,      setNumSims]      = useState(3000);
  const [startDate,    setStartDate]    = useState("2020-01-01");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [results,      setResults]      = useState(null);
  const [detailsOpen,  setDetailsOpen]  = useState(false);

  const portfolioValue = holdings.reduce((sum, h) => sum + h.shares * (h.cur || 0), 0);

  async function runSimulation() {
    if (holdings.length < 2) {
      setError("Add at least 2 positions to your portfolio first.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/montecarlo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers:            holdings.map(h => h.ticker),
          start:              startDate,
          end:                today(),
          strategy,
          initial_investment: initial,
          sim_days:           simDays,
          n_simulations:      numSims,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResults(await res.json());
    } catch (e) {
      setError(e.message || "Simulation failed — check the API server.");
    }
    setLoading(false);
  }

  const bx  = (extra = {}) => ({
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...extra,
  });
  const lbl = text => (
    <div style={{
      fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em",
      textTransform: "uppercase", marginBottom: 14, fontFamily: FONT,
    }}>{text}</div>
  );
  const inp = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 12px", color: C.text, fontFamily: FONT, fontSize: 13,
    outline: "none", transition: "border-color 0.2s",
  };

  const initial = portfolioValue > 0 ? portfolioValue : 10000;
  const stats   = results?.stats;
  const canRun  = holdings.length >= 2 && !loading;

  const statCards = stats ? [
    {
      label: "Median Outcome", value: fmtDollar(stats.median),
      sub: `${((stats.median - initial) / initial * 100).toFixed(1)}% return`,
      color: C.accent, highlight: true,
    },
    {
      label: "Mean Outcome", value: fmtDollar(stats.mean),
      sub: `${((stats.mean - initial) / initial * 100).toFixed(1)}% return`,
      color: C.text,
    },
    {
      label: "95th Percentile", value: fmtDollar(stats.percentile_95),
      sub: "top 5% scenario", color: "#a78bfa",
    },
    {
      label: "5th Percentile", value: fmtDollar(stats.percentile_5),
      sub: "bottom 5% scenario", color: C.red,
    },
    {
      label: "Prob. of Loss",
      value: `${(stats.prob_loss * 100).toFixed(1)}%`,
      sub: "chance below initial",
      color: stats.prob_loss > 0.3 ? C.red : stats.prob_loss > 0.15 ? "#f59e0b" : C.accent,
    },
  ] : [];

  return (
    <div style={{ padding: "20px 28px 40px", fontFamily: FONT }}>
      <style>{`
        .mc-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; border-radius: 2px;
          background: rgba(45,212,160,0.15); cursor: pointer; outline: none;
        }
        .mc-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: #2dd4a0; cursor: pointer;
          box-shadow: 0 0 0 3px rgba(45,212,160,0.15);
        }
        .mc-range::-moz-range-thumb {
          width: 14px; height: 14px; border: none; border-radius: 50%;
          background: #2dd4a0; cursor: pointer;
        }
        @keyframes mc-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── CONFIG ─────────────────────────────────────────────────────── */}
      <div style={{ ...bx(), marginBottom: 16 }}>
        {lbl("Configuration")}

        {/* Portfolio chips + portfolio value */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, fontFamily: FONT }}>
              Portfolio positions
            </div>
            {holdings.length === 0 ? (
              <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic", fontFamily: FONT }}>
                No holdings — add positions from the Portfolio page
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {holdings.map(h => (
                  <div key={h.ticker} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: C.accentDim, border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: "3px 10px",
                    fontSize: 12, fontFamily: FONT,
                  }}>
                    <TickerLogo ticker={h.ticker} size={16} />
                    <span style={{ fontWeight: 600, color: C.text }}>{h.ticker}</span>
                    <span style={{ color: C.textFaint, fontSize: 11 }}>·</span>
                    <span style={{ color: C.textDim, fontSize: 11 }}>{h.shares} sh</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontFamily: FONT }}>
              Portfolio value
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, fontFamily: FONT, letterSpacing: "-0.02em" }}>
              {fmtDollar(initial)}
            </div>
            {portfolioValue === 0 && (
              <div style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT, marginTop: 2 }}>
                fallback — no live prices
              </div>
            )}
          </div>
        </div>

        {/* Strategy buttons */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, fontFamily: FONT }}>Strategy</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(STRAT_LABELS).map(([id, label]) => {
              const a   = strategy === id;
              const col = STRAT_COLORS[id];
              return (
                <button key={id} onClick={() => setStrategy(id)} style={{
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                  background: a ? `${col}18` : "transparent",
                  border:     `1px solid ${a ? col : C.border}`,
                  color:      a ? col : C.textDim,
                  fontSize: 12, fontWeight: a ? 600 : 400,
                  transition: "all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>
        </div>

        {/* Inputs grid */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 20, marginBottom: 24 }}>

          {/* History start date */}
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6, fontFamily: FONT }}>
              History from
            </div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ ...inp, width: "100%", boxSizing: "border-box", colorScheme: "dark" }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e  => e.target.style.borderColor = C.border} />
          </div>

          {/* Horizon slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Horizon</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: FONT }}>
                {fmtDays(simDays)}
              </span>
            </div>
            <input type="range" className="mc-range" min={1} max={756} step={1} value={simDays}
              onChange={e => setSimDays(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>1 day</span>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>3 yr</span>
            </div>
          </div>

          {/* Simulations slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Simulations</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: FONT }}>
                {numSims.toLocaleString()}
              </span>
            </div>
            <input type="range" className="mc-range" min={1000} max={5000} step={1} value={numSims}
              onChange={e => setNumSims(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>1,000</span>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>5,000</span>
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runSimulation}
          disabled={!canRun}
          style={{
            padding: "11px 32px", background: C.accent, border: "none", borderRadius: 8,
            color: "#0b0b12", fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: canRun ? "pointer" : "not-allowed",
            opacity: canRun ? 1 : 0.6,
            boxShadow: `0 2px 16px ${C.accentGlow}`,
            display: "inline-flex", alignItems: "center", gap: 8,
            transition: "opacity 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { if (canRun) e.currentTarget.style.boxShadow = "0 4px 24px rgba(45,212,160,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 16px ${C.accentGlow}`; }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>◎</span>
          {loading ? "Running…" : "Run Simulation"}
        </button>
      </div>

      {/* ── ERROR ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: C.redDim, border: `1px solid rgba(240,80,110,0.3)`,
          borderRadius: 10, padding: "12px 18px", marginBottom: 16,
          color: C.red, fontFamily: FONT, fontSize: 13,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── LOADING ────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{
          ...bx(), display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, padding: "56px 0", marginBottom: 16,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.accent}`,
            animation: "mc-spin 0.75s linear infinite",
          }} />
          <span style={{ color: C.textDim, fontFamily: FONT, fontSize: 13 }}>
            Running {numSims.toLocaleString()} simulations over {fmtDays(simDays)}…
          </span>
        </div>
      )}

      {/* ── RESULTS ────────────────────────────────────────────────────── */}
      {results && !loading && (
        <>
          {/* Stats cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16,
          }}>
            {statCards.map(card => (
              <div key={card.label} style={{
                background: card.highlight ? C.accentDim : C.surface,
                border: `1px solid ${card.highlight ? "rgba(45,212,160,0.2)" : C.border}`,
                borderRadius: 10, padding: "16px 18px",
              }}>
                <div style={{
                  fontSize: 10, color: C.textDim, fontWeight: 500,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  marginBottom: 8, fontFamily: FONT,
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: card.color,
                  fontFamily: FONT, marginBottom: 4, lineHeight: 1.2,
                }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Percentile paths chart */}
          <div style={{ ...bx(), marginBottom: 16 }}>
            {lbl("Percentile Paths")}
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 14, alignItems: "center" }}>
              {PERC_LINES.map(line => (
                <div key={line.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    display: "block", width: 20,
                    height: line.key === "50" ? 3 : 2,
                    background: line.color, borderRadius: 2,
                  }} />
                  <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>{line.label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  display: "block", width: 20, height: 8, borderRadius: 2,
                  background: "rgba(45,212,160,0.12)", border: "1px solid rgba(45,212,160,0.2)",
                }} />
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>25–75th band</span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="20" height="8">
                  <line x1="0" y1="4" x2="20" y2="4"
                    stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 3" />
                </svg>
                <span style={{ fontSize: 11, color: C.textFaint, fontFamily: FONT }}>Initial investment</span>
              </div>
            </div>
            <PercentileChart data={results.percentiles} initialInvestment={initial} />
          </div>

          {/* Distribution histogram */}
          {results.histogram && (
            <div style={{ ...bx(), marginBottom: 16 }}>
              {lbl("Final Value Distribution")}
              <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(45,212,160,0.55)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>Above initial</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(240,80,110,0.55)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>Below initial</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="20" height="8">
                    <line x1="0" y1="4" x2="20" y2="4" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4 3" />
                  </svg>
                  <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>Median</span>
                </div>
              </div>
              <DistributionHistogram
                histogram={results.histogram}
                initialInvestment={initial}
                median={stats.median}
              />
            </div>
          )}

          {/* Scenario cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              {
                label: "Worst Case", sub: "5th percentile",
                value: stats.percentile_5,
                color: C.red, bg: C.redDim, borderColor: "rgba(240,80,110,0.2)",
                icon: "▼",
              },
              {
                label: "Expected", sub: "Median outcome",
                value: stats.median,
                color: C.accent, bg: C.accentDim, borderColor: "rgba(45,212,160,0.2)",
                icon: "◎",
              },
              {
                label: "Best Case", sub: "95th percentile",
                value: stats.percentile_95,
                color: "#a78bfa", bg: "rgba(167,139,250,0.08)", borderColor: "rgba(167,139,250,0.2)",
                icon: "▲",
              },
            ].map(card => {
              const ret = ((card.value - initial) / initial * 100);
              const retPositive = ret >= 0;
              return (
                <div key={card.label} style={{
                  background: card.bg,
                  border: `1px solid ${card.borderColor}`,
                  borderRadius: 12, padding: "20px 22px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: FONT, marginBottom: 4 }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.textFaint, fontFamily: FONT }}>
                        {card.sub}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: card.color, opacity: 0.7 }}>{card.icon}</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.color, fontFamily: FONT, marginBottom: 6, lineHeight: 1.1 }}>
                    {fmtDollar(card.value)}
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: retPositive ? "rgba(45,212,160,0.1)" : "rgba(240,80,110,0.1)",
                    border: `1px solid ${retPositive ? "rgba(45,212,160,0.2)" : "rgba(240,80,110,0.2)"}`,
                    borderRadius: 5, padding: "2px 8px",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: retPositive ? C.accent : C.red, fontFamily: FONT }}>
                      {retPositive ? "+" : ""}{ret.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expandable detailed stats */}
          <div style={{ ...bx(), marginBottom: 16 }}>
            <button
              onClick={() => setDetailsOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "none", border: "none", cursor: "pointer",
                padding: 0, fontFamily: FONT,
              }}
            >
              <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Detailed Statistics
              </div>
              <span style={{
                fontSize: 14, color: C.textDim, transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s", display: "inline-block",
              }}>▾</span>
            </button>
            {detailsOpen && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {[
                    { label: "Mean",     value: fmtDollar(stats.mean) },
                    { label: "Std Dev",  value: fmtDollar(stats.std) },
                    { label: "Minimum",  value: fmtDollar(stats.min) },
                    { label: "Maximum",  value: fmtDollar(stats.max) },
                  ].map(r => (
                    <div key={r.label} style={{
                      background: C.bg, borderRadius: 8, padding: "12px 14px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10, fontFamily: FONT }}>
                  Percentiles
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                  {[
                    { p: "5th",  v: stats.percentile_5,  color: "#f0506e" },
                    { p: "25th", v: stats.percentile_25, color: "#f59e0b" },
                    { p: "50th", v: stats.median,        color: C.accent  },
                    { p: "75th", v: stats.percentile_75, color: "#60a5fa" },
                    { p: "95th", v: stats.percentile_95, color: "#a78bfa" },
                  ].map(r => (
                    <div key={r.p} style={{
                      background: C.bg, borderRadius: 8, padding: "12px 10px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT, marginBottom: 6 }}>{r.p}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: r.color, fontFamily: FONT }}>{fmtDollar(r.v)}</div>
                      <div style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT, marginTop: 3 }}>
                        {((r.v - initial) / initial * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10, fontFamily: FONT }}>
                  Probability Analysis
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[
                    { label: "Prob. of Loss",     value: stats.prob_loss,     color: stats.prob_loss > 0.3 ? C.red : stats.prob_loss > 0.15 ? "#f59e0b" : C.accent },
                    { label: "Prob. Gain > 10%",  value: stats.prob_gain_10,  color: stats.prob_gain_10 > 0.5 ? C.accent : "#f59e0b" },
                    { label: "Prob. Gain > 20%",  value: stats.prob_gain_20,  color: stats.prob_gain_20 > 0.4 ? C.accent : "#f59e0b" },
                  ].map(r => (
                    <div key={r.label} style={{
                      background: C.bg, borderRadius: 8, padding: "12px 14px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: r.color, fontFamily: FONT }}>
                        {(r.value * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 14, color: C.textFaint, flexShrink: 0, lineHeight: 1.4 }}>ⓘ</span>
            <p style={{
              fontSize: 11, color: C.textFaint, fontFamily: FONT, lineHeight: 1.65, margin: 0,
            }}>
              Monte Carlo assumes normally distributed returns. Extreme events like COVID-2020 or 2022 rate
              hikes may occur more frequently than the model predicts. Past return distributions do not
              guarantee future performance. Simulations are for illustrative purposes only.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
