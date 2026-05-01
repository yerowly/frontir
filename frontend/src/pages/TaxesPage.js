import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../theme";
import API from "../api";

const REGIMES = [
  {
    key:   "kazakhstan",
    label: "Kazakhstan",
    rate:  "10% flat",
    note:  "Flat 10% on capital gains for residents. 5% on dividends. No long-term discount.",
    color: "#2dd4a0",
  },
  {
    key:   "usa",
    label: "United States",
    rate:  "20–37%",
    note:  "Short-term (<1 yr): up to 37% ordinary income rate. Long-term (≥1 yr): preferential 20% rate.",
    color: "#60a5fa",
  },
  {
    key:   "none",
    label: "No Tax",
    rate:  "0%",
    note:  "No capital gains tax. Tax-free or offshore jurisdiction. You keep 100% of profits.",
    color: "#a78bfa",
  },
];

function fmt$(v) {
  if (v == null) return "—";
  return (v < 0 ? "−$" : "$") + Math.abs(Math.round(v)).toLocaleString("en");
}

// ─── Comparison chart ──────────────────────────────────────────────────────
function ComparisonChart({ comparison, profit }) {
  const cRef = useRef(null), wRef = useRef(null);
  const [cw, setCw] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver(e => setCw(e[0].contentRect.width));
    if (wRef.current) ro.observe(wRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cRef.current;
    if (!cv || !comparison?.length || !profit) return;

    const W   = cw, dpr = window.devicePixelRatio || 1;
    const rowH = 56, pad = { t: 4, r: 150, b: 4, l: 116 };
    const H   = pad.t + comparison.length * rowH + pad.b;

    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const iw  = W - pad.l - pad.r;
    const rr  = ctx.roundRect ? (...a) => ctx.roundRect(...a) : (...a) => ctx.rect(a[0], a[1], a[2], a[3]);

    comparison.forEach((item, i) => {
      const regime = REGIMES[i];
      const y  = pad.t + i * rowH + 6;
      const bh = rowH - 12;

      // label
      ctx.fillStyle = C.textDim;
      ctx.font = `400 12px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(regime?.label ?? item.regime, pad.l - 10, y + bh / 2 + 4);

      // track
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.beginPath(); rr(pad.l, y, iw, bh, 5); ctx.fill();

      if (profit > 0) {
        const afterFrac = Math.max(0, Math.min(item.after_tax / profit, 1));
        const taxFrac   = Math.max(0, Math.min(item.tax       / profit, 1));
        const afterW    = afterFrac * iw;
        const taxW      = taxFrac   * iw;

        if (afterW > 0) {
          ctx.fillStyle = "rgba(45,212,160,0.5)";
          ctx.beginPath();
          rr(pad.l, y, afterW, bh, taxW > 1 ? [5, 0, 0, 5] : 5);
          ctx.fill();
        }

        if (taxW > 1) {
          ctx.fillStyle = "rgba(240,80,110,0.55)";
          ctx.beginPath();
          rr(pad.l + afterW, y, taxW, bh, [0, 5, 5, 0]);
          ctx.fill();
        }
      }

      // right labels
      ctx.textAlign = "left";
      ctx.fillStyle = C.text;
      ctx.font = `600 12px ${FONT}`;
      ctx.fillText(fmt$(item.after_tax), W - pad.r + 14, y + bh / 2 - 2);
      ctx.fillStyle = item.tax > 0 ? "#f0506e" : C.textFaint;
      ctx.font = `400 10px ${FONT}`;
      ctx.fillText(item.tax > 0 ? `−${fmt$(item.tax)} tax` : "no tax", W - pad.r + 14, y + bh / 2 + 13);
    });
  }, [comparison, cw, profit]);

  return (
    <div ref={wRef} style={{ width: "100%" }}>
      <canvas ref={cRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function TaxesPage({ holdings = [] }) {
  const [regime,       setRegime]       = useState("kazakhstan");
  const [holdingYears, setHoldingYears] = useState(3);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [results,      setResults]      = useState(null);

  const totalValue = holdings.reduce((s, h) => s + h.shares * (h.cur      || 0), 0);
  const costBasis  = holdings.reduce((s, h) => s + h.shares * (h.avgPrice || 0), 0);
  const profit     = totalValue - costBasis;
  const canCalc    = profit > 0 && holdings.length > 0;

  useEffect(() => {
    if (!canCalc) { setResults(null); return; }
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/taxes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profit, holding_years: holdingYears, regime }),
        });
        if (!res.ok) throw new Error(await res.text());
        setResults(await res.json());
      } catch (e) {
        setError(e.message || "Calculation failed — check the API server.");
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [regime, holdingYears, profit, canCalc]);

  const bx  = (extra = {}) => ({
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...extra,
  });
  const lbl = text => (
    <div style={{
      fontSize: 11, color: C.textDim, fontWeight: 500,
      letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 14, fontFamily: FONT,
    }}>{text}</div>
  );

  const cur    = results?.current;
  const regObj = REGIMES.find(r => r.key === regime);
  const pnlPos = profit >= 0;

  return (
    <div style={{ padding: "20px 28px 40px", fontFamily: FONT }}>
      <style>{`
        .tax-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; border-radius: 2px;
          background: rgba(45,212,160,0.15); cursor: pointer; outline: none;
        }
        .tax-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: #2dd4a0; cursor: pointer;
          box-shadow: 0 0 0 3px rgba(45,212,160,0.15);
        }
        .tax-range::-moz-range-thumb {
          width: 14px; height: 14px; border: none; border-radius: 50%;
          background: #2dd4a0; cursor: pointer;
        }
        @keyframes tx-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Portfolio summary ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          {
            label: "Current Value",
            value: fmt$(totalValue),
            color: C.text,
          },
          {
            label: "Cost Basis",
            value: fmt$(costBasis),
            color: C.textMid,
          },
          {
            label: "Unrealized P&L",
            value: fmt$(profit),
            sub:   costBasis > 0
              ? `${profit >= 0 ? "+" : ""}${((profit / costBasis) * 100).toFixed(2)}% return`
              : null,
            color: pnlPos ? C.accent : C.red,
            tinted: true,
          },
        ].map(card => (
          <div key={card.label} style={{
            ...bx({ padding: "18px 20px" }),
            background: card.tinted
              ? (pnlPos ? C.accentDim : C.redDim)
              : C.surface,
            border: `1px solid ${card.tinted
              ? (pnlPos ? "rgba(45,212,160,0.2)" : "rgba(240,80,110,0.2)")
              : C.border}`,
          }}>
            <div style={{
              fontSize: 10, color: C.textDim, fontWeight: 500,
              letterSpacing: "0.05em", textTransform: "uppercase",
              marginBottom: 8, fontFamily: FONT,
            }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontFamily: FONT, letterSpacing: "-0.02em" }}>
              {card.value}
            </div>
            {card.sub && (
              <div style={{ fontSize: 11, color: pnlPos ? C.accentSoft ?? C.accent : C.red, fontFamily: FONT, marginTop: 5, opacity: 0.8 }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Configuration ─────────────────────────────────────────────────── */}
      <div style={{ ...bx(), marginBottom: 16 }}>
        {lbl("Configuration")}

        {/* Holding period */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Holding period</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.accent, fontFamily: FONT }}>
              {holdingYears} {holdingYears === 1 ? "year" : "years"}
            </span>
          </div>
          <input
            type="range" className="tax-range"
            min={1} max={10} step={1}
            value={holdingYears}
            onChange={e => setHoldingYears(+e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>1 yr</span>
            <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT }}>10 yr</span>
          </div>
        </div>

        {/* Tax regime cards */}
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10, fontFamily: FONT }}>
          Tax regime
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {REGIMES.map(r => {
            const a = regime === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setRegime(r.key)}
                style={{
                  background:  a ? `${r.color}10` : C.bg,
                  border:      `1px solid ${a ? r.color : C.border}`,
                  borderRadius: 10, padding: "14px 16px",
                  cursor: "pointer", textAlign: "left",
                  fontFamily: FONT, outline: "none",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!a) e.currentTarget.style.borderColor = C.borderHover; }}
                onMouseLeave={e => { if (!a) e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: a ? r.color : C.text, fontFamily: FONT }}>
                    {r.label}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color:      a ? r.color : C.textDim,
                    background: a ? `${r.color}18` : "rgba(255,255,255,0.04)",
                    borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginLeft: 8,
                  }}>{r.rate}</div>
                </div>
                <div style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.55, fontFamily: FONT }}>
                  {r.note}
                </div>
                {a && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    marginTop: 10, fontSize: 10, color: r.color, fontFamily: FONT,
                    background: `${r.color}15`, borderRadius: 4, padding: "2px 7px",
                  }}>
                    <span>✓</span> Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── No holdings ───────────────────────────────────────────────────── */}
      {holdings.length === 0 && (
        <div style={{
          ...bx(), textAlign: "center", padding: "40px 20px",
          color: C.textDim, fontSize: 13, marginBottom: 16,
        }}>
          <div style={{ fontSize: 30, marginBottom: 12, opacity: 0.25 }}>%</div>
          Add positions from the Portfolio page to calculate taxes.
        </div>
      )}

      {/* ── At a loss ─────────────────────────────────────────────────────── */}
      {holdings.length > 0 && profit <= 0 && (
        <div style={{
          ...bx({ background: C.redDim, border: "1px solid rgba(240,80,110,0.15)" }),
          display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", marginBottom: 16,
        }}>
          <span style={{ fontSize: 22, color: C.red, opacity: 0.6, flexShrink: 0 }}>%</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT, marginBottom: 3 }}>
              No capital gains tax owed
            </div>
            <div style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>
              {profit < 0
                ? `Portfolio is currently down ${fmt$(Math.abs(profit))} — losses can offset future gains.`
                : "Portfolio has no unrealized gains to calculate tax on."}
            </div>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: C.redDim, border: `1px solid rgba(240,80,110,0.3)`,
          borderRadius: 10, padding: "12px 18px", marginBottom: 16,
          color: C.red, fontFamily: FONT, fontSize: 13,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading pulse ─────────────────────────────────────────────────── */}
      {loading && canCalc && !results && (
        <div style={{
          ...bx(), display: "flex", alignItems: "center", gap: 12,
          padding: "20px", marginBottom: 16,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: `2px solid ${C.border}`,
            borderTop: `2px solid ${C.accent}`,
            animation: "tx-spin 0.75s linear infinite",
          }} />
          <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Calculating…</span>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {cur && (
        <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.2s" }}>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              {
                label: "Gross Profit",
                value: fmt$(cur.profit),
                color: C.text,
              },
              {
                label: "Tax Amount",
                value: fmt$(cur.tax),
                color: cur.tax > 0 ? C.red : C.accent,
                tinted: cur.tax > 0,
              },
              {
                label: "After-Tax Profit",
                value: fmt$(cur.after_tax),
                color: C.accent,
                highlight: true,
              },
              {
                label: "Effective Rate",
                value: cur.effective_rate,
                color: cur.tax > 0 ? "#f59e0b" : C.accent,
              },
            ].map(card => (
              <div key={card.label} style={{
                ...bx({ padding: "16px 18px" }),
                background: card.highlight
                  ? C.accentDim
                  : card.tinted
                    ? C.redDim
                    : C.surface,
                border: `1px solid ${
                  card.highlight ? "rgba(45,212,160,0.2)"
                  : card.tinted  ? "rgba(240,80,110,0.15)"
                  : C.border
                }`,
              }}>
                <div style={{
                  fontSize: 10, color: C.textDim, fontWeight: 500,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  marginBottom: 8, fontFamily: FONT,
                }}>{card.label}</div>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: card.color,
                  fontFamily: FONT, letterSpacing: "-0.02em",
                }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* "If you sell today" */}
          <div style={{
            ...bx({ padding: "16px 20px" }),
            background: C.accentDim,
            border: `1px solid rgba(45,212,160,0.15)`,
            marginBottom: 16,
            display: "flex", alignItems: "flex-start", gap: 14,
          }}>
            <span style={{ fontSize: 22, color: C.accent, lineHeight: 1.1, flexShrink: 0, opacity: 0.7 }}>%</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT, marginBottom: 5 }}>
                If you sell today in {regObj?.label}, you keep{" "}
                <span style={{ color: C.accent }}>{fmt$(cur.after_tax)}</span>{" "}
                out of {fmt$(cur.profit)} profit
              </div>
              <div style={{ fontSize: 12, color: C.textDim, fontFamily: FONT, lineHeight: 1.6 }}>
                {cur.tax > 0
                  ? `${cur.effective_rate} effective rate — ${fmt$(cur.tax)} goes to taxes after ${holdingYears} ${holdingYears === 1 ? "year" : "years"} of holding.`
                  : `No tax owed — you keep 100% of your ${fmt$(cur.profit)} gain.`}
              </div>
            </div>
          </div>

          {/* Comparison chart */}
          <div style={{ ...bx(), marginBottom: 16 }}>
            {lbl("Regime Comparison")}
            <div style={{ display: "flex", gap: 20, marginBottom: 16, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(45,212,160,0.5)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>After-tax profit</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(240,80,110,0.55)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>Tax paid</span>
              </div>
            </div>
            <ComparisonChart comparison={results.comparison} profit={profit} />
          </div>

        </div>
      )}
    </div>
  );
}
