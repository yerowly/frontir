import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../theme";
import TickerLogo from "../TickerLogo";
import API from "../api";

function today() { return new Date().toISOString().slice(0, 10); }

// react dev strict mode will mount twice, prevent double auto-run
let __opt_autorun_once = false;

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
  equal:       "#a78bfa",
};


function makeAllocColors(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n < 2 ? 0 : i / (n - 1);
    return `rgb(${Math.round(45+t*20)},${Math.round(212-t*100)},${Math.round(160-t*60)})`;
  });
}

function Donut({ data, colors, size = 120 }) {
  const r = size / 2, sw = 16, rad = r - sw / 2 - 3, circ = 2 * Math.PI * rad;
  let off = 0;
  return (
    <svg width={size} height={size}>
      {data.map((s, i) => {
        const dash = (s.pct / 100) * circ, gap = circ - dash, rot = (off / 100) * 360 - 90;
        off += s.pct;
        return (
          <circle key={s.t} cx={r} cy={r} r={rad} fill="none" stroke={colors[i]}
            strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={`${Math.max(dash - 2, 0)} ${gap + 2}`}
            transform={`rotate(${rot} ${r} ${r})`} style={{ transition: "all 0.5s" }} />
        );
      })}
      <text x={r} y={r + 4} textAnchor="middle" fill={C.text} fontSize="17" fontFamily={FONT} fontWeight="600">
        {data.length}
      </text>
      <text x={r} y={r + 17} textAnchor="middle" fill={C.textDim} fontSize="9" fontFamily={FONT}>
        assets
      </text>
    </svg>
  );
}

function FrontierChart({ data }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [cw, setCw] = useState(600);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current; if (!cv || !data) return;
    const W = cw, H = 340, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { t: 20, r: 20, b: 40, l: 56 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    const { returns: rets, volatilities: vols, sharpes } = data.random_portfolios;
    const allVols = [...vols, ...Object.values(data.optimal).map(o => o.volatility)];
    const allRets = [...rets, ...Object.values(data.optimal).map(o => o.return)];
    const mnV = Math.min(...allVols) * 0.95, mxV = Math.max(...allVols) * 1.05;
    const mnR = Math.min(...allRets) * 0.95, mxR = Math.max(...allRets) * 1.05;

    const px = v => pad.l + ((v - mnV) / (mxV - mnV)) * iw;
    const py = r => pad.t + (1 - (r - mnR) / (mxR - mnR)) * ih;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ih / 4) * i;
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.textFaint; ctx.font = `400 9px ${FONT}`; ctx.textAlign = "right";
      const rv = mxR - ((mxR - mnR) / 4) * i;
      ctx.fillText(`${(rv * 100).toFixed(0)}%`, pad.l - 5, y + 3);
    }
    for (let i = 0; i <= 4; i++) {
      const x = pad.l + (iw / 4) * i;
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
      ctx.fillStyle = C.textFaint; ctx.font = `400 9px ${FONT}`; ctx.textAlign = "center";
      const vv = mnV + ((mxV - mnV) / 4) * i;
      ctx.fillText(`${(vv * 100).toFixed(0)}%`, x, H - pad.b + 14);
    }

    // Axis labels
    ctx.fillStyle = C.textDim; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText("Volatility →", pad.l + iw / 2, H - 2);
    ctx.save(); ctx.translate(12, pad.t + ih / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("Return →", 0, 0); ctx.restore();

    // Sharpe color scale: map to green
    const minS = Math.min(...sharpes), maxS = Math.max(...sharpes), rngS = maxS - minS || 1;

    // Draw random portfolio dots
    const n = Math.min(rets.length, 2000);
    for (let i = 0; i < n; i++) {
      const t = (sharpes[i] - minS) / rngS;
      const r2 = Math.round(240 - t * 195);
      const g2 = Math.round(80 + t * 132);
      const b2 = Math.round(110 - t * 10);
      ctx.beginPath();
      ctx.arc(px(vols[i]), py(rets[i]), 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r2},${g2},${b2},0.5)`;
      ctx.fill();
    }

    // Draw optimal points
    for (const [id, pt] of Object.entries(data.optimal)) {
      const x = px(pt.volatility), y = py(pt.return);
      const col = STRAT_COLORS[id] || C.accent;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = "#0b0b12"; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }, [data, cw]);

  const onMove = e => {
    if (!data) return;
    const r = cRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    // Check proximity to optimal points
    const pad = { t: 20, r: 20, b: 40, l: 56 };
    const iw = cw - pad.l - pad.r, ih = 340 - pad.t - pad.b;
    const { returns: rets, volatilities: vols } = data.random_portfolios;
    const allVols = [...vols, ...Object.values(data.optimal).map(o => o.volatility)];
    const allRets = [...rets, ...Object.values(data.optimal).map(o => o.return)];
    const mnV = Math.min(...allVols) * 0.95, mxV = Math.max(...allVols) * 1.05;
    const mnR = Math.min(...allRets) * 0.95, mxR = Math.max(...allRets) * 1.05;
    const px = v => pad.l + ((v - mnV) / (mxV - mnV)) * iw;
    const py = r => pad.t + (1 - (r - mnR) / (mxR - mnR)) * ih;

    let found = null;
    for (const [id, pt] of Object.entries(data.optimal)) {
      const dx = px(pt.volatility) - mx, dy = py(pt.return) - my;
      if (Math.sqrt(dx * dx + dy * dy) < 14) {
        found = { id, ...pt, cx: px(pt.volatility), cy: py(pt.return) };
        break;
      }
    }
    setTooltip(found);
  };

  return (
    <div ref={wRef} style={{ position: "relative", width: "100%" }}>
      <canvas ref={cRef} onMouseMove={onMove} onMouseLeave={() => setTooltip(null)}
        style={{ display: "block", width: "100%", cursor: "crosshair" }} />
      {tooltip && (
        <div style={{
          position: "absolute",
          top: Math.max(4, tooltip.cy - 70),
          left: Math.min(tooltip.cx + 12, cw - 150),
          background: C.surface, border: `1px solid ${STRAT_COLORS[tooltip.id] || C.borderHover}`,
          borderRadius: 8, padding: "8px 12px", pointerEvents: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: STRAT_COLORS[tooltip.id] || C.accent, marginBottom: 4, fontFamily: FONT }}>
            {STRAT_LABELS[tooltip.id] || tooltip.id}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>Return: <span style={{ color: C.green }}>{(tooltip.return * 100).toFixed(1)}%</span></div>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>Vol: <span style={{ color: C.textMid }}>{(tooltip.volatility * 100).toFixed(1)}%</span></div>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>Sharpe: <span style={{ color: C.accent }}>{tooltip.sharpe.toFixed(3)}</span></div>
        </div>
      )}
    </div>
  );
}

// SVG correlation heatmap
function Heatmap({ tickers, matrix }) {
  const n = tickers.length;
  const cell = Math.min(56, Math.floor(360 / n));
  const labelW = 44;
  const totalW = labelW + n * cell;
  const totalH = labelW + n * cell;

  function corrColor(v) {
    if (v >= 0) {
      const t = v;
      return `rgba(45,212,160,${0.1 + t * 0.7})`;
    } else {
      const t = -v;
      return `rgba(240,80,110,${0.1 + t * 0.6})`;
    }
  }

  return (
    <svg width={totalW} height={totalH} style={{ display: "block", maxWidth: "100%" }}>
      {/* Column labels */}
      {tickers.map((t, i) => (
        <text key={`cl-${t}`}
          x={labelW + i * cell + cell / 2}
          y={labelW - 6}
          textAnchor="middle" fontSize="9" fontFamily={FONT} fill={C.textDim}>{t}</text>
      ))}
      {/* Row labels */}
      {tickers.map((t, i) => (
        <text key={`rl-${t}`}
          x={labelW - 5}
          y={labelW + i * cell + cell / 2 + 3}
          textAnchor="end" fontSize="9" fontFamily={FONT} fill={C.textDim}>{t}</text>
      ))}
      {/* Cells */}
      {matrix.map((row, i) =>
        row.map((val, j) => {
          const x = labelW + j * cell, y = labelW + i * cell;
          const bg = corrColor(val);
          const textColor = Math.abs(val) > 0.4 ? (val > 0 ? C.accent : C.red) : C.textDim;
          return (
            <g key={`${i}-${j}`}>
              <rect x={x} y={y} width={cell - 1} height={cell - 1} rx={3} fill={bg} />
              <text x={x + cell / 2} y={y + cell / 2 + 3} textAnchor="middle"
                fontSize="9" fontFamily={FONT} fontWeight={i === j ? "600" : "400"} fill={textColor}>
                {val.toFixed(2)}
              </text>
            </g>
          );
        })
      )}
    </svg>
  );
}

export default function OptimizerPage({ holdings = [], onAdd }) {
  const [startDate,    setStartDate]   = useState("2020-01-01");
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState(null);
  const [frontier,     setFrontier]    = useState(null);
  const [compare,      setCompare]     = useState(null);
  const [corr,         setCorr]        = useState(null);
  const [bestBy,       setBestBy]      = useState("utility");
  const [rebalStrat,   setRebalStrat]  = useState("max_sharpe");
  const [rebalOpt,     setRebalOpt]    = useState(null);
  const [rebalBase,    setRebalBase]   = useState(null);
  const [rebalLoading, setRebalLoading] = useState(false);

  const analysisTickers = holdings.map(h => h.ticker);

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7578/ingest/88eb278e-3bfa-4055-a6c2-59d80f89b508", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ccc0e3" },
      body: JSON.stringify({
        sessionId: "ccc0e3",
        location: "frontend/src/pages/OptimizerPage.js:mount",
        message: "optimizer mount",
        data: { n: analysisTickers.length, bestBy },
        hypothesisId: "H4",
        runId: "pre-fix",
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // #endregion

  const bx  = (extra = {}) => ({ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...extra });
  const lbl = text => (
    <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em",
      textTransform: "uppercase", marginBottom: 14, fontFamily: FONT }}>{text}</div>
  );

  async function runAnalysis() {
    if (analysisTickers.length < 2) { setError("Add at least 2 positions."); return; }
    setError(null);
    setLoading(true);

    const body = JSON.stringify({ tickers: analysisTickers, start: startDate, end: today(), strategy: "max_sharpe" });
    const headers = { "Content-Type": "application/json" };

    try {
      const [frontierRes, compareRes, corrRes] = await Promise.all([
        fetch(`${API}/api/frontier`, { method: "POST", headers, body }),
        fetch(`${API}/api/optimize/all`, { method: "POST", headers, body }),
        fetch(`${API}/api/correlation`, { method: "POST", headers, body }),
      ]);

      if (!frontierRes.ok) throw new Error(await frontierRes.text());
      if (!compareRes.ok)  throw new Error(await compareRes.text());
      if (!corrRes.ok)     throw new Error(await corrRes.text());

      const [fData, cData, rData] = await Promise.all([
        frontierRes.json(), compareRes.json(), corrRes.json(),
      ]);

      setFrontier(fData);
      setCompare(cData);
      setCorr(rData);
      fetchRebalance(rebalStrat);
    } catch (e) {
      setError(e.message || "Request failed — is the API running?");
    }
    setLoading(false);
  }

  async function fetchRebalance(strategy) {
    if (holdings.length < 2) return;
    setRebalLoading(true);
    const tkrs = holdings.map(h => h.ticker);
    const headers = { "Content-Type": "application/json" };
    const mk = s => JSON.stringify({ tickers: tkrs, start: startDate, end: today(), strategy: s });
    try {
      const [optRes, baseRes] = await Promise.all([
        fetch(`${API}/api/optimize`, { method: "POST", headers, body: mk(strategy) }),
        fetch(`${API}/api/optimize`, { method: "POST", headers, body: mk("equal") }),
      ]);
      if (optRes.ok && baseRes.ok) {
        const [opt, base] = await Promise.all([optRes.json(), baseRes.json()]);
        setRebalOpt(opt);
        setRebalBase(base);
      }
    } catch (e) { console.error("rebalance:", e); }
    setRebalLoading(false);
  }

  useEffect(() => {
    if (__opt_autorun_once) return;
    __opt_autorun_once = true;
    if (holdings.length >= 2) { runAnalysis(); fetchRebalance(rebalStrat); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inp = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 14px", color: C.text, fontFamily: FONT, fontSize: 13,
    outline: "none", transition: "border-color 0.2s",
  };

  function utilScore(m) {
    const dd = Math.abs(m.max_drawdown || 0);
    const sh = m.sharpe || 0;
    const ar = m.annual_return || 0;
    return sh - 0.7 * dd + 0.15 * ar;
  }

  function bestLabel() {
    if (bestBy === "return") return "Return";
    if (bestBy === "drawdown") return "Min DD";
    if (bestBy === "utility") return "Utility";
    return "Sharpe";
  }

  const bestStratId = compare
    ? Object.keys(compare.strategies).reduce((best, id) => {
        const m = compare.strategies[id].metrics || {};
        const mb = best ? (compare.strategies[best].metrics || {}) : null;

        if (!best) return id;
        if (bestBy === "return")   return (m.annual_return > mb.annual_return) ? id : best;
        if (bestBy === "drawdown") return (Math.abs(m.max_drawdown) < Math.abs(mb.max_drawdown)) ? id : best;
        if (bestBy === "utility")  return (utilScore(m) > utilScore(mb)) ? id : best;
        return (m.sharpe > mb.sharpe) ? id : best;
      }, null)
    : "max_sharpe";

  // Rebalancing derived data (computed each render from holdings prop)
  const rbTotal  = holdings.reduce((a, h) => a + h.shares * h.cur, 0);
  const rbColors = makeAllocColors(holdings.length);
  const rbCurAlloc = holdings.map(h => ({
    t: h.ticker,
    pct: rbTotal > 0 ? +(h.shares * h.cur / rbTotal * 100).toFixed(1) : 0,
  }));
  const rbOptAlloc = rebalOpt
    ? holdings.map(h => ({ t: h.ticker, pct: +(((rebalOpt.weights[h.ticker] || 0) * 100).toFixed(1)) }))
    : [];
  const rbRows = rebalOpt ? holdings.map((h, i) => {
    const curWt    = rbTotal > 0 ? h.shares * h.cur / rbTotal : 0;
    const optWt    = rebalOpt.weights[h.ticker] || 0;
    const diffDollar = (optWt - curWt) * rbTotal;
    const diffShares = h.cur > 0 ? Math.abs(diffDollar) / h.cur : 0;
    const action   = Math.abs(optWt - curWt) * 100 < 0.5 ? "ok"
                   : diffDollar > 0 ? "buy" : "sell";
    return { ticker: h.ticker, name: h.name || h.ticker, cur: h.cur,
             curPct: curWt * 100, optPct: optWt * 100,
             diffDollar, diffShares, action, color: rbColors[i] };
  }).sort((a, b) => Math.abs(b.optPct - b.curPct) - Math.abs(a.optPct - a.curPct)) : [];

  return (
    <div style={{ padding: "20px 28px 40px" }}>

      {/* CONTROLS */}
      <div style={{ ...bx({ marginBottom: 18 }) }}>
        {/* Position chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textDim, fontFamily: FONT, marginBottom: 8 }}>
            Positions <span style={{ color: C.textFaint }}>({holdings.length})</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {holdings.map(h => (
              <div key={h.ticker} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: C.accentDim, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: "3px 4px 3px 8px",
                fontSize: 12, fontWeight: 600, color: C.text, fontFamily: FONT,
              }}>
                <TickerLogo ticker={h.ticker} size={16} />
                <span>{h.ticker}</span>
                <span style={{ fontSize: 10, fontWeight: 400, color: C.textDim }}>· {h.shares} sh</span>
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

        {/* Date + Run row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontFamily: FONT }}>Start date</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ ...inp, colorScheme: "dark" }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border} />
          </div>
          <button onClick={runAnalysis} disabled={loading || analysisTickers.length < 2} style={{
            padding: "9px 24px", background: C.accent, border: "none", borderRadius: 8,
            color: "#0b0b12", fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: loading || analysisTickers.length < 2 ? "not-allowed" : "pointer",
            opacity: loading || analysisTickers.length < 2 ? 0.7 : 1,
            boxShadow: `0 2px 16px ${C.accentGlow}`,
          }}>{loading ? "Running…" : "Run Analysis"}</button>
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: C.red, padding: "8px 12px",
            background: C.redDim, borderRadius: 6, fontFamily: FONT }}>{error}</div>
        )}
      </div>

      {/* FRONTIER */}
      <div style={{ ...bx({ marginBottom: 18 }) }}>
        {lbl("Efficient Frontier")}
        {!frontier ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.textDim, fontSize: 13, fontFamily: FONT }}>
            {loading ? "Computing portfolios…" : "Run analysis to see the efficient frontier"}
          </div>
        ) : (
          <>
            <FrontierChart data={frontier} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
              {Object.entries(frontier.optimal).map(([id, pt]) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: STRAT_COLORS[id] || C.accent,
                    boxShadow: `0 0 6px ${STRAT_COLORS[id] || C.accent}` }} />
                  <span style={{ fontSize: 11, color: C.textMid, fontFamily: FONT }}>
                    {STRAT_LABELS[id] || id}
                  </span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT, marginLeft: "auto" }}>
                Dot color: <span style={{ color: C.red }}>low</span> → <span style={{ color: C.green }}>high</span> Sharpe
              </span>
            </div>
          </>
        )}
      </div>

      {/* STRATEGY COMPARISON + CORRELATION */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14 }}>

        {/* STRATEGY TABLE */}
        <div style={bx()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {lbl("Strategy Comparison")}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -6 }}>
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>BEST by</span>
              <select value={bestBy} onChange={e => setBestBy(e.target.value)} style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "6px 10px", color: C.text, fontFamily: FONT, fontSize: 11,
                outline: "none", cursor: "pointer",
              }}>
                <option value="utility">Utility</option>
                <option value="sharpe">Sharpe</option>
                <option value="return">Return</option>
                <option value="drawdown">Min DD</option>
              </select>
            </div>
          </div>
          {!compare ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim, fontSize: 13, fontFamily: FONT }}>
              {loading ? "Computing…" : "Run analysis to compare strategies"}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Strategy", "Return", "Volatility", "Sharpe", "Max DD"].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i === 0 ? "left" : "right", padding: "8px 12px",
                      fontSize: 11, color: C.textDim, fontWeight: 500,
                      borderBottom: `1px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(compare.strategies).map(([id, s]) => {
                  const m = s.metrics;
                  const col = STRAT_COLORS[id] || C.accent;
                  const isRec = id === bestStratId;
                  return (
                    <tr key={id} style={{
                      transition: "background 0.1s",
                      background: isRec ? "rgba(45,212,160,0.04)" : "transparent",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = isRec ? "rgba(45,212,160,0.04)" : "transparent"}>
                      <td style={{
                        padding: "11px 12px", borderBottom: `1px solid ${C.border}`,
                        borderLeft: isRec ? `2px solid ${C.accent}` : "2px solid transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: FONT }}>
                            {STRAT_LABELS[id] || id}
                          </span>
                          {isRec && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, color: C.accent,
                              background: C.accentDim, padding: "2px 6px",
                              borderRadius: 4, letterSpacing: "0.05em",
                            }}>BEST ({bestLabel()})</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`,
                        color: C.green, fontWeight: 500, fontFamily: FONT }}>
                        +{(m.annual_return * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`,
                        color: C.textMid, fontFamily: FONT }}>
                        {(m.volatility * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`,
                        color: C.accent, fontWeight: 600, fontFamily: FONT }}>
                        {m.sharpe.toFixed(3)}
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`,
                        color: C.red, fontFamily: FONT }}>
                        {(m.max_drawdown * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* CORRELATION HEATMAP */}
        <div style={bx()}>
          {lbl("Correlation")}
          {!corr ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.textDim, fontSize: 13, fontFamily: FONT, minWidth: 200 }}>
              {loading ? "Computing…" : "Run analysis"}
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <Heatmap tickers={corr.tickers} matrix={corr.matrix} />
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                <div style={{ width: 40, height: 6, borderRadius: 3,
                  background: "linear-gradient(90deg, rgba(240,80,110,0.7), rgba(45,212,160,0.7))" }} />
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>−1 → +1</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* HOW TO REBALANCE */}
      {holdings.length >= 2 && (
        <div style={{ ...bx({ marginTop: 18, marginBottom: 18 }) }}>
          {lbl("How to Rebalance")}

          {/* Strategy tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(STRAT_LABELS).map(([id, label]) => {
              const a = rebalStrat === id;
              return (
                <button key={id}
                  onClick={() => { setRebalStrat(id); fetchRebalance(id); }}
                  style={{
                    padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                    background: a ? C.accentDim : "transparent",
                    border: `1px solid ${a ? "rgba(45,212,160,0.3)" : C.border}`,
                    color: a ? C.accent : C.textDim, fontSize: 12, fontWeight: a ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >{label}</button>
              );
            })}
            {rebalLoading && (
              <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT, marginLeft: 4 }}>
                Computing…
              </span>
            )}
          </div>

          {!rebalOpt ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: C.textDim, fontSize: 13, fontFamily: FONT }}>
              {rebalLoading ? "Computing recommendations…" : "Loading…"}
            </div>
          ) : (
            <>
              {/* Summary banner */}
              {rebalBase && rebalStrat !== "equal" && (() => {
                const sharpeUp = rebalOpt.metrics.sharpe > rebalBase.metrics.sharpe;
                const ddUp     = rebalOpt.metrics.max_drawdown > rebalBase.metrics.max_drawdown;
                if (sharpeUp) {
                  return (
                    <div style={{
                      background: "rgba(45,212,160,0.04)", border: `1px solid rgba(45,212,160,0.15)`,
                      borderRadius: 10, padding: "13px 18px", marginBottom: 20,
                      display: "flex", alignItems: "flex-start", gap: 12,
                    }}>
                      <span style={{ fontSize: 18, color: C.accent, lineHeight: 1.6 }}>↗</span>
                      <div style={{ fontSize: 12.5, color: C.textMid, fontFamily: FONT, lineHeight: 1.75 }}>
                        Rebalancing to{" "}
                        <strong style={{ color: C.accent }}>{STRAT_LABELS[rebalStrat]}</strong>
                        {" "}would improve your Sharpe ratio from{" "}
                        <strong style={{ color: C.textMid }}>{rebalBase.metrics.sharpe.toFixed(3)}</strong>
                        {" → "}
                        <strong style={{ color: C.green }}>{rebalOpt.metrics.sharpe.toFixed(3)}</strong>
                        {ddUp
                          ? <>{" "}and reduce max drawdown from{" "}
                              <strong style={{ color: C.textMid }}>{(rebalBase.metrics.max_drawdown * 100).toFixed(1)}%</strong>
                              {" → "}
                              <strong style={{ color: C.accent }}>{(rebalOpt.metrics.max_drawdown * 100).toFixed(1)}%</strong>
                            </>
                          : <>{" "}(max drawdown{" "}
                              <strong style={{ color: C.red }}>{(rebalOpt.metrics.max_drawdown * 100).toFixed(1)}%</strong>
                              {" "}vs {(rebalBase.metrics.max_drawdown * 100).toFixed(1)}% baseline)
                            </>
                        }
                        <span style={{ color: C.textFaint, fontSize: 10 }}>{" "}(vs equal-weight baseline)</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{
                    background: "rgba(245,158,11,0.06)", border: `1px solid rgba(245,158,11,0.25)`,
                    borderRadius: 10, padding: "13px 18px", marginBottom: 20,
                    display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <span style={{ fontSize: 18, color: "#f59e0b", lineHeight: 1.6 }}>⚠</span>
                    <div style={{ fontSize: 12.5, color: C.textMid, fontFamily: FONT, lineHeight: 1.75 }}>
                      <strong style={{ color: "#f59e0b" }}>Warning:</strong>
                      {" "}{STRAT_LABELS[rebalStrat]} would{" "}
                      <strong style={{ color: C.red }}>decrease</strong>
                      {" "}your Sharpe ratio from{" "}
                      <strong style={{ color: C.textMid }}>{rebalBase.metrics.sharpe.toFixed(3)}</strong>
                      {" → "}
                      <strong style={{ color: C.red }}>{rebalOpt.metrics.sharpe.toFixed(3)}</strong>
                      {" "}(vs equal-weight baseline).{" "}
                      {bestStratId && bestStratId !== rebalStrat && (
                        <>Consider{" "}
                          <strong style={{ color: C.accent }}>{STRAT_LABELS[bestStratId]}</strong>
                          {" "}instead — Sharpe{" "}
                          <strong style={{ color: C.green }}>
                            {compare.strategies[bestStratId].metrics.sharpe.toFixed(3)}
                          </strong>.
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Two donuts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                {[
                  { title: "Current Allocation", alloc: rbCurAlloc },
                  { title: `Optimal — ${STRAT_LABELS[rebalStrat]}`, alloc: rbOptAlloc },
                ].map(({ title, alloc }) => (
                  <div key={title} style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "18px 20px", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 14,
                  }}>
                    <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500,
                      letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: FONT }}>
                      {title}
                    </div>
                    <Donut data={alloc} colors={rbColors} size={120} />
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                      {alloc.map((a, i) => (
                        <div key={a.t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: rbColors[i], flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 11, color: C.textMid, fontFamily: FONT }}>{a.t}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.textDim, fontFamily: FONT }}>{a.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rebalancing table */}
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 100px 90px 190px",
                  background: C.bg, borderBottom: `1px solid ${C.border}`, padding: "9px 16px",
                }}>
                  {["Asset", "Current", "Optimal", "Change", "Action"].map((h, i) => (
                    <div key={h} style={{
                      fontSize: 10, color: C.textDim, fontWeight: 500, fontFamily: FONT,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      textAlign: i === 0 ? "left" : "right",
                    }}>{h}</div>
                  ))}
                </div>

                {rbRows.map(row => {
                  const isBuy  = row.action === "buy";
                  const isSell = row.action === "sell";
                  const isOk   = row.action === "ok";
                  const actionColor = isBuy ? C.green : isSell ? C.red : C.textDim;
                  const actionBg    = isBuy ? C.greenDim : isSell ? C.redDim : "transparent";
                  return (
                    <div key={row.ticker} style={{
                      display: "grid", gridTemplateColumns: "1fr 100px 100px 90px 190px",
                      padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                      alignItems: "center", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <TickerLogo ticker={row.ticker} size={28} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT }}>{row.ticker}</div>
                          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>{row.name}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: C.textMid, fontFamily: FONT }}>
                          {row.curPct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.accent, fontFamily: FONT }}>
                          {row.optPct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isOk ? (
                          <span style={{ fontSize: 12, color: C.textFaint, fontFamily: FONT }}>—</span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT, color: actionColor }}>
                            {isBuy ? "+" : ""}{(row.optPct - row.curPct).toFixed(1)}pp
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isOk ? (
                          <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>✓ No change</span>
                        ) : (
                          <div>
                            <span style={{
                              display: "inline-block", padding: "3px 8px", borderRadius: 5,
                              fontSize: 11, fontWeight: 600, background: actionBg,
                              color: actionColor, fontFamily: FONT, marginBottom: 2,
                            }}>
                              {isBuy ? "BUY" : "SELL"} ${Math.abs(row.diffDollar).toLocaleString("en", { maximumFractionDigits: 0 })}
                            </span>
                            <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>
                              {isSell ? "Sell" : "Buy"} {row.diffShares.toFixed(1)} sh @ ${row.cur.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
