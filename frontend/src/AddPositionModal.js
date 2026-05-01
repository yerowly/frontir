import { useState, useRef, useEffect } from "react";
import { C, FONT } from "./theme";
import TickerLogo from "./TickerLogo";
import API from "./api";

export default function AddPositionModal({ open, onClose, onAdd }) {
  const [query, setQuery]           = useState("");
  const [selected, setSelected]     = useState(null);
  const [showDrop, setShowDrop]     = useState(false);
  const [shares, setShares]         = useState("");
  const [price, setPrice]           = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceErr, setPriceErr]     = useState(null);
  const [results, setResults]       = useState([]);
  const sharesRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setSelected(null); setShowDrop(false);
      setShares(""); setPrice(null); setPriceLoading(false); setPriceErr(null);
      setResults([]);
    }
  }, [open]);

  if (!open) return null;

  async function doSearch(q) {
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(
        (data.quotes || [])
          .filter(qt => qt.symbol && (qt.longname || qt.shortname))
          .slice(0, 10)
          .map(qt => ({ s: qt.symbol, n: qt.longname || qt.shortname, exchange: qt.exchDisp || qt.exchange || "" }))
      );
    } catch {
      setResults([]);
    }
  }

  function handleQueryChange(val) {
    setQuery(val);
    setSelected(null); setPrice(null); setPriceErr(null);
    setShowDrop(true);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (val.length >= 2) {
      searchRef.current = setTimeout(() => doSearch(val), 300);
    } else {
      setResults([]);
    }
  }

  async function fetchPrice(ticker) {
    setPriceLoading(true); setPriceErr(null); setPrice(null);
    try {
      const end   = new Date().toISOString().slice(0, 10);
      const d     = new Date(); d.setDate(d.getDate() - 14);
      const start = d.toISOString().slice(0, 10);
      const companion = ticker === "SPY" ? "QQQ" : "SPY";
      const res = await fetch(`${API}/api/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: [ticker, companion], start, end }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const vals = data.prices[ticker]?.values;
      if (vals?.length) setPrice(vals[vals.length - 1]);
      else throw new Error("No price data");
    } catch {
      setPriceErr("Could not fetch price — check ticker or API connection.");
    }
    setPriceLoading(false);
  }

  function handleSelect(t) {
    setSelected(t); setQuery(t.s); setShowDrop(false);
    fetchPrice(t.s);
    setTimeout(() => sharesRef.current?.focus(), 50);
  }

  function handleAdd() {
    if (!selected || !(Number(shares) > 0) || price === null) return;
    onAdd(selected.s, selected.n, Number(shares), price);
  }

  const inp = {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "11px 14px", color: C.text, fontFamily: FONT, fontSize: 14, fontWeight: 400,
    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
  };

  const canAdd = selected && Number(shares) > 0 && price !== null && !priceLoading;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.borderHover}`, borderRadius: 16,
        padding: "28px 32px", width: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        animation: "fadeUp 0.25s ease",
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, fontFamily: FONT, marginBottom: 24 }}>
          Add Position
        </div>

        {/* Ticker autocomplete */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: C.textDim, fontFamily: FONT, display: "block", marginBottom: 6 }}>
            Ticker
          </label>
          <div style={{ position: "relative" }}>
            <input
              value={query}
              placeholder="Search ticker or company name…"
              autoComplete="off"
              style={inp}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={e => { e.target.style.borderColor = C.accent; setShowDrop(true); }}
              onBlur={e => { e.target.style.borderColor = C.border; setTimeout(() => setShowDrop(false), 160); }}
            />
            {showDrop && results.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 200,
                background: "#13131e", border: `1px solid ${C.borderHover}`, borderRadius: 8,
                overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
              }}>
                {results.map(t => (
                  <div key={t.s} onMouseDown={() => handleSelect(t)} style={{
                    padding: "10px 14px", cursor: "pointer", display: "flex",
                    alignItems: "center", gap: 12,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <TickerLogo ticker={t.s} size={24} />
                    <span style={{ fontWeight: 600, color: C.text, fontSize: 13, minWidth: 60, fontFamily: FONT }}>{t.s}</span>
                    <span style={{ color: C.textDim, fontSize: 11, fontFamily: FONT }}>
                      — {t.n}{t.exchange ? ` (${t.exchange})` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shares */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: C.textDim, fontFamily: FONT, display: "block", marginBottom: 6 }}>
            Number of shares
          </label>
          <input
            ref={sharesRef}
            type="number" min="0.0001" step="any"
            value={shares} onChange={e => setShares(e.target.value)}
            placeholder="10"
            style={inp}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e => e.target.style.borderColor = C.border}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          />
        </div>

        {/* Auto-fetched price */}
        {(selected || priceLoading || priceErr) && (
          <div style={{
            background: C.accentDim, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "10px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>Current Price</span>
            {priceLoading && (
              <span style={{ fontSize: 12, color: C.textDim, fontFamily: FONT }}>Fetching…</span>
            )}
            {!priceLoading && price !== null && (
              <span style={{ fontSize: 15, fontWeight: 600, color: C.accent, fontFamily: FONT }}>
                ${price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            {!priceLoading && priceErr && (
              <span style={{ fontSize: 11, color: C.red, fontFamily: FONT }}>{priceErr}</span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", background: "transparent", border: `1px solid ${C.border}`,
            borderRadius: 8, color: C.textMid, fontFamily: FONT, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={handleAdd} disabled={!canAdd} style={{
            flex: 1, padding: "11px 0",
            background: canAdd ? C.accent : C.accentDim,
            border: "none", borderRadius: 8,
            color: canAdd ? "#0b0b12" : C.textDim,
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: canAdd ? "pointer" : "not-allowed",
            boxShadow: canAdd ? `0 2px 12px ${C.accentGlow}` : "none",
            transition: "all 0.2s",
          }}>Add to Portfolio</button>
        </div>
      </div>
    </div>
  );
}
