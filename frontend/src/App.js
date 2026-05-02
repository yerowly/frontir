import { useState, useEffect } from "react";
import { C, FONT } from "./theme";
import { LayoutCtx, NARROW_MAX } from "./layout";
import { HOLDINGS } from "./data";
import AddPositionModal from "./AddPositionModal";
import PortfolioPage  from "./pages/PortfolioPage";
import OptimizerPage  from "./pages/OptimizerPage";
import BacktestPage   from "./pages/BacktestPage";
import MonteCarloPage from "./pages/MonteCarloPage";
import TaxesPage      from "./pages/TaxesPage";
import ModelPage      from "./pages/ModelPage";
import API from "./api";

// #region agent log
const __DBG_EP = "http://127.0.0.1:7578/ingest/88eb278e-3bfa-4055-a6c2-59d80f89b508";
function __dbg(location, message, data, hypothesisId, runId) {
  fetch(__DBG_EP, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ccc0e3" },
    body: JSON.stringify({
      sessionId: "ccc0e3",
      location, message, data: data || {},
      hypothesisId: hypothesisId || "H?",
      runId: runId || "pre-fix",
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

// react dev strict mode will mount twice, this prevents double init calls
let __app_init_once = false;

const NAV = [
  { id: "portfolio",  l: "Portfolio",   ico: "◈" },
  { id: "optimizer",  l: "Optimizer",   ico: "⬡" },
  { id: "backtest",   l: "Backtest",    ico: "↻" },
  { id: "montecarlo", l: "Monte Carlo", ico: "◎" },
  { id: "taxes",      l: "Taxes",       ico: "%" },
  { id: "model",      l: "Model",       ico: "△" },
];

const PAGES = {
  portfolio:  PortfolioPage,
  optimizer:  OptimizerPage,
  backtest:   BacktestPage,
  montecarlo: MonteCarloPage,
  taxes:      TaxesPage,
  model:      ModelPage,
};

const REGIME_STYLE = {
  bull:     { label: "BULL",     color: "#2dd4a0", bg: "rgba(45,212,160,0.12)"  },
  bear:     { label: "BEAR",     color: "#f0506e", bg: "rgba(240,80,110,0.12)" },
  sideways: { label: "SIDE",     color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
};


export default function App() {
  const [page, setPage]           = useState("portfolio");
  const [narrow, setNarrow]       = useState(
    typeof window !== "undefined" ? window.innerWidth <= NARROW_MAX : false
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal]         = useState(false);
  const [holdings, setHoldings]   = useState(HOLDINGS);
  const [watchlist, setWatchlist] = useState(["BTC-USD", "ETH-USD", "SPY", "TSLA", "SOL-USD"]);
  const [regimeInfo, setRegimeInfo] = useState(null);

  useEffect(() => {
    if (__app_init_once) return;
    __app_init_once = true;
    __dbg("frontend/src/App.js:__mount", "app mount", { ua: navigator.userAgent }, "H1", "pre-fix");

    // #region agent log
    // fetch wrapper: log failed requests + non-2xx
    const origFetch = window.fetch;
    if (!window.__dbgFetchWrapped) {
      window.__dbgFetchWrapped = true;
      window.fetch = async (...args) => {
        const url = args && args[0] ? String(args[0]) : "";
        const isApi = url.includes("/api/");
        if (isApi) __dbg("frontend/src/App.js:fetch", "fetch start", { url }, "H5", "pre-fix");
        try {
          const res = await origFetch(...args);
          if (isApi) __dbg("frontend/src/App.js:fetch", "fetch end", { url, status: res.status }, "H5", "pre-fix");
          if (!res.ok) {
            __dbg("frontend/src/App.js:fetch", "fetch !ok", { url, status: res.status }, "H5", "pre-fix");
          }
          return res;
        } catch (e) {
          __dbg("frontend/src/App.js:fetch", "fetch threw", { url, err: String(e && (e.message || e)) }, "H5", "pre-fix");
          throw e;
        }
      };
    }
    // #endregion

    const onErr = (msg, src, line, col, err) => {
      __dbg("frontend/src/App.js:window.onerror", "window error", {
        msg: String(msg), src: String(src), line, col,
        err: err ? String(err.stack || err.message || err) : null,
      }, "H2", "pre-fix");
    };
    const onRej = (ev) => {
      const r = ev && ev.reason;
      __dbg("frontend/src/App.js:unhandledrejection", "unhandled rejection", {
        reason: r ? String(r.stack || r.message || r) : String(r),
      }, "H2", "pre-fix");
    };

    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  useEffect(() => {
    __dbg("frontend/src/App.js:nav", "page", { page }, "H6", "pre-fix");
  }, [page]);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_MAX}px)`);
    const on = () => {
      setNarrow(mq.matches);
      if (!mq.matches) setDrawerOpen(false);
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (narrow && drawerOpen) {
      const o = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = o; };
    }
  }, [narrow, drawerOpen]);

  useEffect(() => {
    const tickers = HOLDINGS.map(h => h.ticker);
    if (tickers.length < 2) return;
    const end = new Date().toISOString().slice(0, 10);
    fetch(`${API}/api/regime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers, start: "2020-01-01", end }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) {
          __dbg("frontend/src/App.js:regime", "regime ok", { regime: d.regime, keys: Object.keys(d || {}) }, "H3", "pre-fix");
          setRegimeInfo(d);
        } else {
          __dbg("frontend/src/App.js:regime", "regime empty", {}, "H3", "pre-fix");
        }
      })
      .catch(() => {});
  }, []);

  const PageComponent = PAGES[page] || PortfolioPage;

  function handleAddPosition(ticker, name, shares, curPrice) {
    setHoldings(prev => {
      const existing = prev.find(h => h.ticker === ticker);
      if (existing) {
        const totalShares = existing.shares + shares;
        const newAvg = (existing.avgPrice * existing.shares + curPrice * shares) / totalShares;
        return prev.map(h =>
          h.ticker === ticker
            ? { ...h, shares: totalShares, avgPrice: +newAvg.toFixed(4), cur: curPrice }
            : h
        );
      }
      return [...prev, { ticker, name, shares, avgPrice: curPrice, cur: curPrice, ch: 0 }];
    });
    setModal(false);
  }

  function handleRemovePosition(ticker) {
    setHoldings(prev => prev.filter(h => h.ticker !== ticker));
  }

  function handleAddToWatchlist(ticker) {
    setWatchlist(prev => prev.includes(ticker) ? prev : [...prev, ticker]);
  }

  function handleRemoveFromWatchlist(ticker) {
    setWatchlist(prev => prev.filter(t => t !== ticker));
  }

  const goNav = (id) => {
    setPage(id);
    if (narrow) setDrawerOpen(false);
  };

  return (
    <LayoutCtx.Provider value={{ narrow }}>
    <div style={{
      fontFamily: FONT, background: C.bg, color: C.text, minHeight: "100vh", display: "flex",
      fontSize: narrow ? 12 : 13, maxWidth: "100vw", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Stack+Sans+Text:wght@200..700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.accentDim};border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {narrow && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1001,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: narrow ? 222 : 210,
        borderRight: narrow ? "none" : `1px solid ${C.border}`,
        padding: "20px 0",
        display: "flex", flexDirection: "column", flexShrink: 0,
        background: "linear-gradient(180deg, #0e0e18 0%, #0b0b12 100%)",
        ...(narrow ? {
          position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 1002,
          transform: drawerOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.22s ease",
          boxShadow: drawerOpen ? "8px 0 40px rgba(0,0,0,0.45)" : "none",
        } : {}),
      }}>
        <div style={{ padding: "0 20px", marginBottom: 32, textAlign: "center" }}>
          <img src="/logo_alt.svg" alt="" style={{ width: narrow ? 150 : 170, height: "auto" }} />
        </div>

        <nav style={{ flex: 1 }}>
          {NAV.map(n => {
            const a = page === n.id;
            return (
              <button key={n.id} onClick={() => goNav(n.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 20px", border: "none", cursor: "pointer",
                background: a ? C.accentDim : "transparent",
                borderLeft: a ? `2px solid ${C.accent}` : "2px solid transparent",
                color: a ? C.text : C.textDim,
                fontFamily: FONT, fontSize: 13, fontWeight: a ? 500 : 400, textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!a) { e.currentTarget.style.color = C.textMid; e.currentTarget.style.background = "rgba(45,212,160,0.03)"; } }}
              onMouseLeave={e => { if (!a) { e.currentTarget.style.color = C.textDim; e.currentTarget.style.background = "transparent"; } }}
              >
                <span style={{ width: 18, textAlign: "center", opacity: a ? 1 : 0.5 }}>{n.ico}</span>
                {n.l}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500, marginBottom: 8, letterSpacing: "0.05em" }}>REGIME</div>
          {(() => {
            const rs  = regimeInfo ? (REGIME_STYLE[regimeInfo.regime] ?? REGIME_STYLE.sideways) : null;
            const conf = regimeInfo ? Math.round((regimeInfo.confidence[regimeInfo.regime] || 0) * 100) : null;
            return (
              <div style={{
                background: rs ? rs.bg : C.greenDim,
                borderRadius: 8, padding: "8px 12px",
                display: "flex", alignItems: "center", gap: 8,
                opacity: regimeInfo ? 1 : 0.45,
                transition: "opacity 0.4s",
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: rs ? rs.color : C.accent,
                  flexShrink: 0,
                }} />
                <span style={{ color: rs ? rs.color : C.accent, fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
                  {rs ? rs.label : "———"}
                </span>
                {conf !== null && (
                  <span style={{ color: rs.color, fontSize: 10, fontWeight: 400, marginLeft: "auto", opacity: 0.75, fontFamily: FONT }}>
                    {conf}%
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{
          padding: narrow ? "10px 14px" : "12px 28px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          background: "rgba(14,14,24,0.5)", backdropFilter: "blur(12px)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 20, minWidth: 0, flex: 1 }}>
            {narrow && (
              <button
                type="button"
                onClick={() => setDrawerOpen(o => !o)}
                aria-label="Open menu"
                style={{
                  width: 44, minWidth: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`,
                  background: C.surface, color: C.text, cursor: "pointer", fontSize: 20, lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >☰</button>
            )}
            <span style={{ fontSize: narrow ? 11 : 12, color: C.textDim, fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {new Date().toLocaleDateString("en-US", { weekday: narrow ? undefined : "short", month: "short", day: "numeric", year: narrow ? "2-digit" : "numeric" })}
            </span>
            {!narrow && (
              <>
                <div style={{ width: 1, height: 14, background: C.border, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.textDim, fontWeight: 400 }}>{holdings.length} positions</span>
              </>
            )}
          </div>
          {page === "portfolio" && (
            <button onClick={() => setModal(true)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", background: C.accent, border: "none", borderRadius: 8,
              color: "#0b0b12", fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: `0 2px 10px ${C.accentGlow}`, transition: "opacity 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              + Add Position
            </button>
          )}
        </header>

        <div style={{ flex: 1, overflow: "auto" }}>
          <PageComponent
            holdings={holdings}
            onAdd={() => setModal(true)}
            onRemove={handleRemovePosition}
            watchlist={watchlist}
            onAddToWatchlist={handleAddToWatchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
          />
        </div>

        <div style={{
          padding: narrow ? "12px 14px" : "12px 28px",
          borderTop: `1px solid ${C.border}`,
          fontSize: narrow ? 9 : 10,
          color: C.textFaint,
          lineHeight: 1.6,
        }}>
          Built on math + a trained ML model. Not financial advice. Results can be wrong.
        </div>
      </main>

      <AddPositionModal open={modal} onClose={() => setModal(false)} onAdd={handleAddPosition} />
    </div>
    </LayoutCtx.Provider>
  );
}
