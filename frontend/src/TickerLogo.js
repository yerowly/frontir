import { useState } from "react";
import { C, FONT } from "./theme";

function fallbackLetter(ticker) {
  return ticker.replace(/-USD$/, "").replace(/\..+$/, "")[0].toUpperCase();
}

function getLogoSrc(ticker) {
  if (ticker.endsWith("-USD")) {
    const sym = ticker.replace(/-USD$/, "").toLowerCase();
    return `https://assets.coincap.io/assets/icons/${sym}@2x.png`;
  }
  return `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}`;
}

export default function TickerLogo({ ticker, size = 24 }) {
  const [err, setErr] = useState(false);

  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6,
        background: C.accentDim, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.42), fontWeight: 700,
        color: C.accent, fontFamily: FONT,
      }}>
        {fallbackLetter(ticker)}
      </div>
    );
  }

  return (
    <img
      src={getLogoSrc(ticker)}
      alt={ticker}
      onError={() => setErr(true)}
      style={{
        width: size, height: size,
        borderRadius: 6, objectFit: "contain",
        flexShrink: 0, display: "block",
        background: "#12121f",
      }}
    />
  );
}
