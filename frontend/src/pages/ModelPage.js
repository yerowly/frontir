import { useState, useEffect } from "react";
import { C, FONT } from "../theme";
import API from "../api";

const REGIME_CFG = {
  bull:     { label: "BULL",     color: "#2dd4a0", bg: "rgba(45,212,160,0.06)",  border: "rgba(45,212,160,0.18)",  desc: "Strong upward momentum detected. The model favors growth-oriented allocations." },
  bear:     { label: "BEAR",     color: "#f0506e", bg: "rgba(240,80,110,0.06)", border: "rgba(240,80,110,0.18)", desc: "Downward pressure detected. The model recommends defensive, low-volatility positioning." },
  sideways: { label: "SIDEWAYS", color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)", desc: "Range-bound market detected. The model recommends balanced risk distribution." },
};

const CONF_BARS = [
  { key: "bull",     label: "Bull",     color: "#2dd4a0" },
  { key: "sideways", label: "Sideways", color: "#f59e0b" },
  { key: "bear",     label: "Bear",     color: "#f0506e" },
];

const STRAT_META = {
  max_sharpe:  { label: "Max Sharpe",   ico: "⬡" },
  min_var:     { label: "Min Variance", ico: "◈" },
  risk_parity: { label: "Risk Parity",  ico: "◉" },
  max_return:  { label: "Max Return",   ico: "△" },
  equal:       { label: "Equal Weight", ico: "◌" },
};

const STRAT_REASON = {
  max_return:  r => `In a ${r} market, Max Return concentrates in the highest-expected-return assets to capture maximum upside.`,
  min_var:     r => `In a ${r} market, Min Variance protects capital by minimizing portfolio volatility and drawdown.`,
  risk_parity: r => `In a ${r} market, Risk Parity balances risk evenly across all assets, avoiding concentration in any direction.`,
  max_sharpe:  r => `Max Sharpe optimizes the risk-adjusted return ratio — strong across most market conditions.`,
  equal:       r => `Equal Weight provides simple, diversified exposure with no single asset dominating.`,
};

function makeColors(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n < 2 ? 0 : i / (n - 1);
    return `rgb(${Math.round(45 + t * 20)},${Math.round(212 - t * 100)},${Math.round(160 - t * 60)})`;
  });
}

function Donut({ data, colors, size = 150 }) {
  const r = size / 2, sw = 18, rad = r - sw / 2 - 3, circ = 2 * Math.PI * rad;
  let off = 0;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {data.map((s, i) => {
        const dash = (s.pct * 100 / 100) * circ;
        const gap  = circ - dash;
        const rot  = (off * 360) - 90;
        off += s.pct;
        return (
          <circle key={s.t} cx={r} cy={r} r={rad} fill="none"
            stroke={colors[i]} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={`${Math.max(dash - 2, 0)} ${gap + 2}`}
            transform={`rotate(${rot} ${r} ${r})`}
            style={{ transition: "all 0.5s" }} />
        );
      })}
      <text x={r} y={r - 2}  textAnchor="middle" fill={C.text}    fontSize="18" fontFamily={FONT} fontWeight="600">{data.length}</text>
      <text x={r} y={r + 14} textAnchor="middle" fill={C.textDim} fontSize="10" fontFamily={FONT} fontWeight="400">assets</text>
    </svg>
  );
}

function today() { return new Date().toISOString().slice(0, 10); }

// react dev strict mode will mount twice, this prevents double auto-run
let __model_autorun_once = false;

export default function ModelPage({ holdings = [] }) {
  const [startDate,   setStartDate]   = useState("2020-01-01");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [notTrained,  setNotTrained]  = useState(false);
  const [data,        setData]        = useState(null);

  async function analyze() {
    if (holdings.length < 2) {
      setError("Add at least 2 positions to your portfolio first.");
      return;
    }
    setLoading(true); setError(null); setNotTrained(false);
    try {
      const res = await fetch(`${API}/api/regime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: holdings.map(h => h.ticker),
          start:   startDate,
          end:     today(),
        }),
      });
      if (res.status === 503) { setNotTrained(true); setLoading(false); return; }
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e.message || "Analysis failed — check the API server.");
    }
    setLoading(false);
  }

  // Auto-run on mount when holdings are ready
  useEffect(() => {
    if (__model_autorun_once) return;
    __model_autorun_once = true;
    if (holdings.length >= 2) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bx  = (extra = {}) => ({
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...extra,
  });
  const lbl = text => (
    <div style={{
      fontSize: 11, color: C.textDim, fontWeight: 500,
      letterSpacing: "0.05em", textTransform: "uppercase",
      marginBottom: 14, fontFamily: FONT,
    }}>{text}</div>
  );

  const canRun = holdings.length >= 2 && !loading;
  const rc     = data ? (REGIME_CFG[data.regime] ?? REGIME_CFG.sideways) : null;

  const weightEntries = data?.weights
    ? Object.entries(data.weights).sort((a, b) => b[1] - a[1])
    : [];
  const donutData   = weightEntries.map(([t, w]) => ({ t, pct: w }));
  const donutColors = makeColors(donutData.length);

  return (
    <div style={{ padding: "20px 28px 40px", fontFamily: FONT }}>
      <style>{`
        @keyframes mdl-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div style={{ ...bx(), marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1, minWidth: 0 }}>
          {holdings.length === 0 ? (
            <span style={{ fontSize: 12, color: C.textDim, fontStyle: "italic", fontFamily: FONT }}>
              No holdings — add positions from the Portfolio page
            </span>
          ) : holdings.map(h => (
            <div key={h.ticker} style={{
              background: C.accentDim, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "3px 10px",
              fontSize: 12, fontWeight: 600, color: C.text, fontFamily: FONT,
            }}>{h.ticker}</div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>History from</span>
          <input
            type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7,
              padding: "7px 10px", color: C.text, fontFamily: FONT, fontSize: 12,
              outline: "none", colorScheme: "dark",
            }}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e  => e.target.style.borderColor = C.border}
          />
          <button
            onClick={analyze} disabled={!canRun}
            style={{
              padding: "8px 20px", background: canRun ? C.accent : "rgba(45,212,160,0.2)",
              border: "none", borderRadius: 7,
              color: canRun ? "#0b0b12" : C.accent,
              fontFamily: FONT, fontSize: 12, fontWeight: 600,
              cursor: canRun ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 7,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => { if (canRun) e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            {loading ? (
              <div style={{
                width: 13, height: 13, borderRadius: "50%",
                border: "2px solid rgba(11,11,18,0.25)",
                borderTop: "2px solid #0b0b12",
                animation: "mdl-spin 0.75s linear infinite",
              }} />
            ) : <span style={{ fontSize: 13 }}>△</span>}
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {/* ── Model not trained ───────────────────────────────────────────── */}
      {notTrained && (
        <div style={{
          ...bx({ padding: "36px 28px" }),
          background: "rgba(245,158,11,0.04)",
          border: "1px solid rgba(245,158,11,0.18)",
          marginBottom: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3, color: "#f59e0b" }}>△</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, marginBottom: 8 }}>
            Model not trained
          </div>
          <div style={{ fontSize: 12, color: C.textDim, fontFamily: FONT, maxWidth: 400, margin: "0 auto 16px", lineHeight: 1.65 }}>
            The regime detection model needs to be trained before it can make predictions.
            Run the following command in your project directory:
          </div>
          <div style={{
            display: "inline-block",
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "9px 18px",
            fontFamily: "monospace", fontSize: 13, color: C.accent,
          }}>
            python -m core.model
          </div>
          <div style={{ fontSize: 11, color: C.textFaint, fontFamily: FONT, marginTop: 12 }}>
            Training uses historical data from 2018–2024 and takes a few minutes.
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
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

      {/* ── Loading (initial, no prior data) ────────────────────────────── */}
      {loading && !data && (
        <div style={{ ...bx(), display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "56px 0", marginBottom: 16 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.accent}`,
            animation: "mdl-spin 0.75s linear infinite",
          }} />
          <span style={{ fontSize: 13, color: C.textDim, fontFamily: FONT }}>
            Running regime analysis…
          </span>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>

          {/* Regime banner */}
          <div style={{
            ...bx({ padding: "44px 28px 40px" }),
            marginBottom: 16, textAlign: "center",
            background: rc.bg, border: `1px solid ${rc.border}`,
          }}>
            <div style={{
              fontSize: 56, fontWeight: 800, letterSpacing: "0.1em",
              color: rc.color, fontFamily: FONT,
              textShadow: `0 0 24px ${rc.color}22`,
              lineHeight: 1,
            }}>
              {rc.label}
            </div>
            <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500, letterSpacing: "0.12em", marginTop: 10, fontFamily: FONT, textTransform: "uppercase" }}>
              Predicted Market Regime
            </div>
            <div style={{ fontSize: 13, color: C.textMid, marginTop: 8, fontFamily: FONT, maxWidth: 480, margin: "10px auto 0" }}>
              {rc.desc}
            </div>
          </div>

          {/* Confidence + Strategy row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Confidence breakdown */}
            <div style={{ ...bx() }}>
              {lbl("Confidence Breakdown")}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {[...CONF_BARS]
                  .sort((a, b) => (data.confidence[b.key] || 0) - (data.confidence[a.key] || 0))
                  .map(bar => {
                    const pct     = (data.confidence[bar.key] || 0) * 100;
                    const isMain  = bar.key === data.regime;
                    return (
                      <div key={bar.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                          <span style={{
                            fontSize: 12, fontFamily: FONT,
                            fontWeight: isMain ? 600 : 400,
                            color: isMain ? bar.color : C.textDim,
                          }}>{bar.label}</span>
                          <span style={{
                            fontSize: 14, fontWeight: 700, fontFamily: FONT,
                            color: isMain ? bar.color : C.textMid,
                          }}>{pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 4,
                            width: `${pct}%`,
                            background: bar.color,
                            opacity: isMain ? 1 : 0.35,
                            boxShadow: isMain ? `0 0 10px ${bar.color}55` : "none",
                            transition: "width 0.7s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Recommended strategy */}
            <div style={{ ...bx() }}>
              {lbl("Recommended Strategy")}
              {(() => {
                const sm  = STRAT_META[data.recommended_strategy] ?? { label: data.recommended_strategy, ico: "⬡" };
                const why = STRAT_REASON[data.recommended_strategy]?.(rc.label) ?? "";
                return (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: `${rc.color}0e`,
                      border: `1px solid ${rc.color}28`,
                      borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                    }}>
                      <span style={{ fontSize: 22, color: rc.color, lineHeight: 1, flexShrink: 0 }}>{sm.ico}</span>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: rc.color, fontFamily: FONT }}>{sm.label}</div>
                        <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT, marginTop: 2, letterSpacing: "0.04em" }}>
                          REGIME-OPTIMIZED
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7, fontFamily: FONT }}>
                      {why}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Recommended weights */}
          {donutData.length > 0 && (
            <div style={{ ...bx(), marginBottom: 16 }}>
              {lbl("Recommended Allocation")}
              <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
                <Donut data={donutData} colors={donutColors} size={150} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {donutData.map((w, i) => (
                    <div key={w.t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 2,
                        background: donutColors[i], flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: C.text,
                        width: 62, fontFamily: FONT,
                      }}>{w.t}</span>
                      <div style={{
                        flex: 1, height: 5, borderRadius: 3,
                        background: "rgba(255,255,255,0.05)", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${w.pct * 100}%`,
                          background: donutColors[i],
                          transition: "width 0.5s",
                        }} />
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: C.text,
                        width: 46, textAlign: "right", fontFamily: FONT,
                      }}>{(w.pct * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Model info */}
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, color: C.textFaint, flexShrink: 0, lineHeight: 1.3 }}>△</span>
            <div>
              <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, fontFamily: FONT, marginBottom: 5 }}>
                About this model
              </div>
              <p style={{ fontSize: 11, color: C.textFaint, fontFamily: FONT, lineHeight: 1.7, margin: 0 }}>
                Uses a Random Forest classifier trained on historical market features: momentum, volatility, rolling correlations, RSI, and drawdown across 5, 10, 21, and 63-day windows. Predicts the current market regime (Bull / Sideways / Bear) and recommends an optimal portfolio strategy for that regime. Strategy mapping: Bull → Max Return, Bear → Min Variance, Sideways → Risk Parity. Cross-validation accuracy ~57%. Predictions are probabilistic and not financial advice.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
