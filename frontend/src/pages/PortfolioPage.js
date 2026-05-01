import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../theme";
import { STRATS, TICKERS, filterTickers } from "../data";
import TickerLogo from "../TickerLogo";
import API from "../api";

function today() { return new Date().toISOString().slice(0, 10); }

// react dev strict mode will mount twice, avoid double identical fetches
let __pf_wl_key = null;
let __pf_init_key = null;

function periodToStart(p) {
  const d = new Date();
  if (p === "1W") d.setDate(d.getDate() - 7);
  else if (p === "1M") d.setMonth(d.getMonth() - 1);
  else if (p === "3M") d.setMonth(d.getMonth() - 3);
  else if (p === "1Y") d.setFullYear(d.getFullYear() - 1);
  else return "2018-01-01";
  return d.toISOString().slice(0, 10);
}

function makeAllocColors(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n < 2 ? 0 : i / (n - 1);
    return `rgb(${Math.round(45 + t * 20)},${Math.round(212 - t * 100)},${Math.round(160 - t * 60)})`;
  });
}

function Spark({ uid, data, w = 64, h = 24, pos = true }) {
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const col = pos ? C.green : C.red;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - mn) / rng) * (h - 4)}`).join(" ");
  const gid = `sg-${uid}`;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.25" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chart({ values, dates, loading }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [tip, setTip] = useState(null);
  const [cw, setCw] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current; if (!cv) return;
    const W = cw, H = 260, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!values || values.length < 2) {
      ctx.fillStyle = C.textDim; ctx.font = `400 12px ${FONT}`; ctx.textAlign = "center";
      ctx.fillText(loading ? "Loading…" : "No data", W / 2, H / 2);
      return;
    }

    const pad = { t: 16, r: 12, b: 24, l: 60 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const mn = Math.min(...values) * 0.98, mx = Math.max(...values) * 1.02;
    const tx = i => pad.l + (i / (values.length - 1)) * iw;
    const ty = v => pad.t + (1 - (v - mn) / (mx - mn)) * ih;

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ih / 4) * i;
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.textFaint; ctx.font = `400 10px ${FONT}`; ctx.textAlign = "right";
      const val = mx - ((mx - mn) / 4) * i;
      ctx.fillText(val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`, pad.l - 6, y + 3);
    }

    const g = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    g.addColorStop(0, "rgba(45,212,160,0.12)");
    g.addColorStop(0.6, "rgba(45,212,160,0.04)");
    g.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.moveTo(tx(0), H - pad.b);
    values.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(values.length - 1), H - pad.b);
    ctx.fillStyle = g; ctx.fill();

    ctx.beginPath();
    values.forEach((v, i) => { i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v)); });
    const lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, C.accentMuted); lg.addColorStop(1, C.accent);
    ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.stroke();

    const ex = tx(values.length - 1), ey = ty(values[values.length - 1]);
    ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.accent; ctx.shadowColor = C.accent; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;

    if (tip !== null && tip >= 0 && tip < values.length) {
      const cx2 = tx(tip), cy2 = ty(values[tip]);
      ctx.strokeStyle = "rgba(45,212,160,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cx2, pad.t); ctx.lineTo(cx2, H - pad.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx2, cy2, 5, 0, Math.PI * 2);
      ctx.fillStyle = C.accent; ctx.shadowColor = C.accent; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    }
  }, [values, cw, tip, loading]);

  const onMove = e => {
    if (!values || values.length < 2) return;
    const r = cRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const idx = Math.round(((x - 60) / (r.width - 60 - 12)) * (values.length - 1));
    if (idx >= 0 && idx < values.length) setTip(idx);
  };

  return (
    <div ref={wRef} style={{ position: "relative", width: "100%" }}>
      <canvas ref={cRef} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ cursor: "crosshair", width: "100%", display: "block" }} />
      {tip !== null && values && tip < values.length && (
        <div style={{
          position: "absolute", top: 4,
          left: Math.min((tip / (values.length - 1)) * (cw - 72) + 60, cw - 140),
          background: C.surface, border: `1px solid ${C.borderHover}`, borderRadius: 8,
          padding: "6px 12px", pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>
            {dates && dates[tip] ? dates[tip] : `Day ${tip}`}
          </div>
          <div style={{ fontSize: 15, color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
            ${values[tip].toLocaleString("en", { maximumFractionDigits: 0 })}
          </div>
        </div>
      )}
    </div>
  );
}

function Donut({ data, colors, size = 150 }) {
  const r = size / 2, sw = 20, rad = r - sw / 2 - 3, circ = 2 * Math.PI * rad;
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
      <text x={r} y={r - 2} textAnchor="middle" fill={C.text} fontSize="20" fontFamily={FONT} fontWeight="600">
        {data.length}
      </text>
      <text x={r} y={r + 14} textAnchor="middle" fill={C.textDim} fontSize="10" fontFamily={FONT} fontWeight="400">
        assets
      </text>
    </svg>
  );
}

export default function PortfolioPage({
  holdings = [],
  onAdd,
  onRemove,
  watchlist = [],
  onAddToWatchlist,
  onRemoveFromWatchlist,
}) {
  const [strat, setStrat] = useState("max_sharpe");
  const [wlOpen, setWlOpen]     = useState(true);
  const [wlAdding, setWlAdding] = useState(false);
  const [wlQuery, setWlQuery]   = useState("");
  const [wlShowDrop, setWlShowDrop] = useState(false);
  const [wlData, setWlData]     = useState({});
  const [wlLoading, setWlLoading] = useState(false);
  const [wlHover, setWlHover]   = useState(null);

  const [period, setPeriod] = useState("3M");
  const [chart, setChart] = useState({ values: [], dates: [] });
  const [chartLoading, setChartLoading] = useState(false);
  const [optMetrics, setOptMetrics] = useState(null);
  const [optLoading, setOptLoading] = useState(false);

  const totVal  = holdings.reduce((a, h) => a + h.shares * h.cur, 0);
  const totCost = holdings.reduce((a, h) => a + h.shares * h.avgPrice, 0);
  const totPL   = totVal - totCost;
  const totPct  = totCost > 0 ? (totPL / totCost) * 100 : 0;

  const liveAllocColors = makeAllocColors(holdings.length);
  const liveAlloc = holdings.map(h => ({
    t: h.ticker,
    pct: totVal > 0 ? +((h.shares * h.cur / totVal) * 100).toFixed(1) : 0,
  }));

  // Fetch real watchlist prices whenever the tickers list changes
  useEffect(() => {
    async function fetchWatchlistPrices() {
      if (!watchlist || watchlist.length === 0) { setWlData({}); return; }
      setWlLoading(true);
      try {
        const end   = today();
        const d     = new Date(); d.setDate(d.getDate() - 20);
        const start = d.toISOString().slice(0, 10);
        let fetchList = [...watchlist];
        if (fetchList.length < 2) {
          fetchList = [...fetchList, fetchList[0] === "SPY" ? "QQQ" : "SPY"];
        }
        const res = await fetch(`${API}/api/prices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: fetchList, start, end }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const next = {};
        for (const ticker of watchlist) {
          const pd = data.prices[ticker];
          if (!pd || pd.values.length < 2) continue;
          const vals  = pd.values;
          const price = vals[vals.length - 1];
          const prev  = vals[vals.length - 2];
          next[ticker] = {
            price,
            change: ((price - prev) / prev) * 100,
            spark:  vals.slice(-14),
          };
        }
        setWlData(next);
      } catch (e) {
        console.error("watchlist fetch:", e);
      }
      setWlLoading(false);
    }
    const key = (watchlist || []).join(",");
    if (key && key === __pf_wl_key) return;
    __pf_wl_key = key;
    fetchWatchlistPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  async function fetchChart(p, h) {
    if (!h || h.length < 2) return;
    setChartLoading(true);
    try {
      const res = await fetch(`${API}/api/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: h.map(x => x.ticker), start: periodToStart(p), end: today() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const first = data.tickers[0];
      const dates = data.prices[first].dates;
      const values = dates.map((_, di) =>
        h.reduce((sum, ho) => sum + (data.prices[ho.ticker]?.values[di] ?? 0) * ho.shares, 0)
      );
      setChart({ values, dates });
    } catch (e) { console.error("chart fetch:", e); }
    setChartLoading(false);
  }

  async function fetchOptimize(s, h) {
    if (!h || h.length < 2) return;
    setOptLoading(true);
    try {
      const res = await fetch(`${API}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: h.map(x => x.ticker), start: "2020-01-01", end: today(), strategy: s }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOptMetrics(data.metrics);
    } catch (e) { console.error("optimize fetch:", e); }
    setOptLoading(false);
  }

  useEffect(() => {
    const key = `${period}|${strat}|` + (holdings || []).map(h => `${h.ticker}:${h.shares}`).join("|");
    if (key && key === __pf_init_key) return;
    __pf_init_key = key;
    fetchChart(period, holdings);
    fetchOptimize(strat, holdings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.length]);

  function handlePeriod(p) { setPeriod(p); fetchChart(p, holdings); }
  function handleStrat(s)  { setStrat(s);  fetchOptimize(s, holdings); }

  // const allocColors = makeAllocColors(optAlloc.length);

  const bx  = (extra = {}) => ({ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...extra });
  const lbl = text => (
    <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em",
      textTransform: "uppercase", marginBottom: 14, fontFamily: FONT }}>{text}</div>
  );

  const metricsCards = [
    { l: "Total Value",    v: `$${totVal.toLocaleString("en", { maximumFractionDigits: 0 })}`, c: C.text, fw: 700 },
    { l: "Unrealized P&L",
      v: `${totPL >= 0 ? "+" : ""}$${Math.abs(totPL).toLocaleString("en", { maximumFractionDigits: 0 })}`,
      sub: `${totPct >= 0 ? "+" : ""}${totPct.toFixed(2)}%`, c: totPL >= 0 ? C.green : C.red, fw: 600 },
    { l: "Sharpe Ratio",
      v: optMetrics ? optMetrics.sharpe.toFixed(3) : (optLoading ? "…" : "—"),
      sub: STRATS.find(s => s.id === strat)?.name ?? strat, c: C.accent, fw: 600 },
    { l: "Max Drawdown",
      v: optMetrics ? `${(optMetrics.max_drawdown * 100).toFixed(1)}%` : (optLoading ? "…" : "—"),
      sub: optMetrics ? `${(optMetrics.volatility * 100).toFixed(1)}% vol` : null, c: C.red, fw: 600 },
  ];

  // Watchlist autocomplete matches — exclude already-added tickers
  const wlMatches = filterTickers(wlQuery).filter(t => !watchlist.includes(t.s));

  function handleWlSelect(ticker) {
    onAddToWatchlist && onAddToWatchlist(ticker);
    setWlAdding(false); setWlShowDrop(false); setWlQuery("");
  }

  function openWlSearch() {
    setWlOpen(true); setWlAdding(true);
  }

  return (
    <div style={{ padding: "20px 28px 40px" }}>

      {/* WATCHLIST */}
      <div style={{ ...bx({ padding: 0, marginBottom: 18 }) }}>

        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", padding: "10px 20px",
          borderBottom: wlOpen ? `1px solid ${C.border}` : "none",
        }}>
          {/* Title toggles expand/collapse */}
          <span onClick={() => setWlOpen(v => !v)} style={{
            fontSize: 11, color: C.textDim, fontWeight: 500, letterSpacing: "0.05em",
            flex: 1, cursor: "pointer", userSelect: "none",
          }}>WATCHLIST</span>

          {/* Inline autocomplete search (shown when wlAdding) */}
          {wlAdding ? (
            <div style={{ position: "relative", marginRight: 10, flexShrink: 0 }}>
              <input
                autoFocus
                value={wlQuery}
                placeholder="Search ticker…"
                autoComplete="off"
                style={{
                  width: 190, background: C.bg, border: `1px solid ${C.accent}`,
                  borderRadius: 6, padding: "4px 10px", color: C.text, fontFamily: FONT,
                  fontSize: 12, outline: "none",
                }}
                onChange={e => { setWlQuery(e.target.value); setWlShowDrop(true); }}
                onBlur={() => setTimeout(() => { setWlAdding(false); setWlShowDrop(false); setWlQuery(""); }, 160)}
              />
              {wlShowDrop && (
                <div style={{
                  position: "absolute", top: "calc(100% + 3px)", right: 0, width: 300,
                  zIndex: 200, background: "#13131e", border: `1px solid ${C.borderHover}`,
                  borderRadius: 8, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                }}>
                  {wlMatches.length > 0 ? wlMatches.map(t => (
                    <div key={t.s} onMouseDown={() => handleWlSelect(t.s)} style={{
                      padding: "9px 14px", cursor: "pointer", display: "flex",
                      alignItems: "center", gap: 12,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <TickerLogo ticker={t.s} size={20} />
                      <span style={{ fontWeight: 600, color: C.text, fontSize: 12, minWidth: 72, fontFamily: FONT }}>{t.s}</span>
                      <span style={{ color: C.textDim, fontSize: 11, fontFamily: FONT }}>{t.n}</span>
                    </div>
                  )) : (
                    <div style={{ padding: "12px 14px", color: C.textDim, fontSize: 12, fontFamily: FONT }}>
                      {wlQuery.length > 0 ? (watchlist.includes(wlQuery.toUpperCase()) ? "Already in watchlist" : "No results") : "Type to search…"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* + button */
            <button
              onClick={e => { e.stopPropagation(); openWlSearch(); }}
              title="Add to watchlist"
              style={{
                width: 20, height: 20, borderRadius: 5, border: `1px solid ${C.border}`,
                background: "transparent", color: C.textDim, cursor: "pointer",
                fontSize: 15, lineHeight: 1, marginRight: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
            >+</button>
          )}

          {/* Collapse chevron */}
          <span onClick={() => setWlOpen(v => !v)} style={{
            fontSize: 9, color: C.textDim, transition: "transform 0.2s", display: "inline-block",
            transform: wlOpen ? "rotate(180deg)" : "rotate(0deg)", cursor: "pointer",
          }}>▼</span>
        </div>

        {/* Items grid */}
        {wlOpen && (
          watchlist.length === 0 ? (
            <div style={{ padding: "22px 20px", textAlign: "center", color: C.textDim, fontSize: 12, fontFamily: FONT }}>
              Watchlist is empty — click <strong style={{ color: C.accent }}>+</strong> to add tickers
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${watchlist.length}, 1fr)` }}>
              {watchlist.map((ticker, i) => {
                const d   = wlData[ticker];
                const pos = d ? d.change >= 0 : true;
                const name = TICKERS.find(t => t.s === ticker)?.n ?? ticker;
                const safeUid = ticker.replace(/[^a-zA-Z0-9]/g, "_");
                return (
                  <div key={ticker} style={{
                    padding: "14px 16px", position: "relative",
                    borderRight: i < watchlist.length - 1 ? `1px solid ${C.border}` : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; setWlHover(ticker); }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; setWlHover(null); }}>

                    {/* Remove × */}
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveFromWatchlist && onRemoveFromWatchlist(ticker); }}
                      title={`Remove ${ticker}`}
                      style={{
                        position: "absolute", top: 7, right: 7,
                        width: 18, height: 18, borderRadius: 4, border: "none",
                        background: "transparent", color: C.textDim, cursor: "pointer",
                        fontSize: 13, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: wlHover === ticker ? 1 : 0,
                        transition: "opacity 0.15s, color 0.1s, background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = C.redDim; }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.background = "transparent"; }}
                    >×</button>

                    {/* Ticker + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, paddingRight: 18 }}>
                      <TickerLogo ticker={ticker} size={22} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: FONT }}>{ticker}</span>
                      <span style={{ flex: 1, fontSize: 10, color: C.textDim, fontWeight: 300, fontFamily: FONT,
                        textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </span>
                    </div>

                    {/* Price + sparkline */}
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                      <div>
                        {d ? (
                          <>
                            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, lineHeight: 1.2, fontFamily: FONT }}>
                              ${d.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 500, color: pos ? C.green : C.red, fontFamily: FONT }}>
                              {pos ? "+" : ""}{d.change.toFixed(2)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDim, lineHeight: 1.2, fontFamily: FONT }}>
                              {wlLoading ? "…" : "—"}
                            </div>
                            <span style={{ fontSize: 11, color: C.textDim }}>&nbsp;</span>
                          </>
                        )}
                      </div>
                      {d && d.spark.length >= 2 && (
                        <Spark uid={`wl_${safeUid}`} data={d.spark} w={56} h={22} pos={pos} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
        {metricsCards.map((c, i) => (
          <div key={i} style={{ ...bx(), animation: `fadeUp 0.4s ease ${i * 0.06}s backwards` }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 400, marginBottom: 10 }}>{c.l}</div>
            <div style={{ fontSize: 24, fontWeight: c.fw, color: c.c, lineHeight: 1.1 }}>{c.v}</div>
            {c.sub && <div style={{ fontSize: 11, color: C.textDim, fontWeight: 400, marginTop: 5 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* CHART + ALLOCATION */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 270px", gap: 14, marginBottom: 18 }}>
        <div style={bx()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            {lbl("Performance")}
            <div style={{ display: "flex", gap: 2 }}>
              {["1W", "1M", "3M", "1Y", "ALL"].map(pp => {
                const active = pp === period;
                return (
                  <button key={pp} onClick={() => handlePeriod(pp)} style={{
                    padding: "4px 10px", fontSize: 10, fontFamily: FONT,
                    fontWeight: active ? 600 : 400,
                    background: active ? C.accentDim : "transparent",
                    border: `1px solid ${active ? C.borderHover : "transparent"}`,
                    borderRadius: 6, color: active ? C.accent : C.textDim, cursor: "pointer",
                  }}>{pp}</button>
                );
              })}
            </div>
          </div>
          <Chart values={chart.values} dates={chart.dates} loading={chartLoading} />
        </div>

        <div style={bx()}>
          {lbl("Allocation")}
          {holdings.length === 0 ? (
            <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "60px 0", fontFamily: FONT }}>
              Add at least 1 holding
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 16px" }}>
                <Donut data={liveAlloc} colors={liveAllocColors} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {liveAlloc.map((a, i) => (
                  <div key={a.t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: liveAllocColors[i], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: C.textMid }}>{a.t}</span>
                    <div style={{ width: 44, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${a.pct}%`, height: "100%", background: liveAllocColors[i], borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.textDim, minWidth: 36, textAlign: "right" }}>{a.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* STRATEGY */}
      <div style={{ marginBottom: 18 }}>
        {lbl("Strategy")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 10 }}>
          {STRATS.map(s => {
            const a = strat === s.id;
            return (
              <button key={s.id} onClick={() => handleStrat(s.id)} style={{
                padding: "14px 12px", borderRadius: 10, cursor: "pointer",
                background: a ? C.accentDim : C.surface,
                border: `1px solid ${a ? "rgba(45,212,160,0.25)" : C.border}`,
                fontFamily: FONT, textAlign: "center", transition: "all 0.2s",
                opacity: optLoading ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!a) e.currentTarget.style.borderColor = C.borderHover; }}
              onMouseLeave={e => { if (!a) e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ fontSize: 13, fontWeight: a ? 600 : 500, color: a ? C.accent : C.textMid, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 10, fontWeight: 400, color: C.textDim }}>{s.d}</div>
              </button>
            );
          })}
        </div>
        {optMetrics && (
          <div style={{ display: "flex", gap: 0, background: C.accentDim,
            border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            {[
              ["Annual Return", `+${(optMetrics.annual_return * 100).toFixed(1)}%`, C.green],
              ["Volatility",    `${(optMetrics.volatility * 100).toFixed(1)}%`,      C.textMid],
              ["Sharpe",        optMetrics.sharpe.toFixed(3),                          C.accent],
              ["Sortino",       optMetrics.sortino?.toFixed(3) ?? "—",                 C.accentSoft],
              ["Max Drawdown",  `${(optMetrics.max_drawdown * 100).toFixed(1)}%`,     C.red],
            ].map(([label, value, color], i, arr) => (
              <div key={label} style={{
                flex: 1, textAlign: "center", padding: "12px 8px",
                borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontFamily: FONT }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color, fontFamily: FONT }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HOLDINGS */}
      <div style={bx()}>
        {lbl("Holdings")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Asset", "Shares", "Avg Price", "Current", "P&L", "Change", "Weight", ""].map((h, i) => (
                <th key={i} style={{
                  textAlign: i === 0 ? "left" : "right", padding: "8px 12px",
                  fontSize: 11, color: C.textDim, fontWeight: 500, borderBottom: `1px solid ${C.border}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const pl  = (h.cur - h.avgPrice) * h.shares;
              const pct = ((h.cur - h.avgPrice) / h.avgPrice) * 100;
              const wt  = totVal > 0 ? (h.shares * h.cur / totVal) * 100 : 0;
              const pos = pl >= 0;
              return (
                <tr key={`${h.ticker}-${i}`} style={{ transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <TickerLogo ticker={h.ticker} size={32} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{h.ticker}</div>
                        <div style={{ fontSize: 10, color: C.textDim, fontWeight: 300 }}>{h.name || h.ticker}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 400 }}>{h.shares}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 400 }}>${h.avgPrice.toFixed(2)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 500 }}>${h.cur.toFixed(2)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: pos ? C.green : C.red, fontWeight: 500 }}>
                    {pos ? "+" : ""}${Math.abs(pl).toLocaleString("en", { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, color: pos ? C.green : C.red,
                      background: pos ? C.greenDim : C.redDim, padding: "3px 8px", borderRadius: 5,
                    }}>{pos ? "+" : ""}{pct.toFixed(1)}%</span>
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${wt}%`, height: "100%", background: C.accent, borderRadius: 2, opacity: 0.5 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.textDim, minWidth: 36 }}>{wt.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 8px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => onRemove && onRemove(h.ticker)}
                      title={`Remove ${h.ticker}`}
                      style={{
                        width: 24, height: 24, borderRadius: 6, border: "none",
                        background: "transparent", color: C.textDim, cursor: "pointer",
                        fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center",
                        justifyContent: "center", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.redDim; e.currentTarget.style.color = C.red; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textDim; }}
                    >×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "12px 0 4px" }}>
          <button onClick={onAdd} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: `1px dashed ${C.border}`,
            borderRadius: 8, padding: "8px 16px",
            fontSize: 12, color: C.textDim, fontFamily: FONT, cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}>
            + Add position
          </button>
        </div>
      </div>

    </div>
  );
}
