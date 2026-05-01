export const HOLDINGS = [
  { ticker: "AAPL", name: "Apple Inc.", shares: 15, avgPrice: 178.5, cur: 198.12, ch: +1.24 },
  { ticker: "MSFT", name: "Microsoft", shares: 10, avgPrice: 380.0, cur: 415.67, ch: -0.38 },
  { ticker: "GOOGL", name: "Alphabet", shares: 8, avgPrice: 140.2, cur: 172.45, ch: +2.15 },
  { ticker: "AMZN", name: "Amazon", shares: 12, avgPrice: 155.0, cur: 189.33, ch: +0.87 },
  { ticker: "NVDA", name: "NVIDIA", shares: 20, avgPrice: 480.0, cur: 890.25, ch: +3.42 },
  { ticker: "GLD", name: "Gold ETF", shares: 25, avgPrice: 185.0, cur: 214.8, ch: +0.15 },
  { ticker: "JPM", name: "JPMorgan", shares: 18, avgPrice: 165.3, cur: 198.45, ch: -0.62 },
];

export const WATCH = [
  { t: "BTC", n: "Bitcoin",  p: 104154.5, ch: +2.34, s: [40,42,38,44,43,47,49,46,52,55,53,58,56,60] },
  { t: "ETH", n: "Ethereum", p: 2250.0,   ch: -1.5,  s: [60,58,55,53,50,48,52,49,47,45,48,46,44,42] },
  { t: "SOL", n: "Solana",   p: 178.42,   ch: +5.12, s: [30,32,28,35,38,36,40,42,45,43,48,50,52,55] },
  { t: "SPY", n: "S&P 500",  p: 585.23,   ch: +0.42, s: [50,51,49,52,51,53,52,54,53,55,54,56,55,57] },
  { t: "TSLA", n: "Tesla",   p: 248.67,   ch: -2.18, s: [65,62,60,58,55,57,54,52,50,53,48,50,47,45] },
];

export const PERF = (() => {
  const d = []; let v = 45000;
  for (let i = 0; i < 90; i++) { v += (Math.random() - 0.42) * 800; v = Math.max(v, 30000); d.push(v); }
  return d;
})();

export const ALLOC = [
  { t: "NVDA", pct: 32.8 }, { t: "AAPL", pct: 18.2 }, { t: "MSFT", pct: 15.6 },
  { t: "GLD",  pct: 12.1 }, { t: "AMZN", pct: 9.8  }, { t: "GOOGL", pct: 6.3 }, { t: "JPM", pct: 5.2 },
];
export const allocC = ALLOC.map((_, i) => {
  const t = i / (ALLOC.length - 1);
  return `rgb(${Math.round(45+t*20)},${Math.round(212-t*100)},${Math.round(160-t*60)})`;
});

export const STRATS = [
  { id: "max_sharpe",  name: "Max Sharpe",   d: "Best risk-adjusted" },
  { id: "min_var",     name: "Min Variance",  d: "Lowest volatility"  },
  { id: "risk_parity", name: "Risk Parity",   d: "Equal risk"         },
  { id: "max_return",  name: "Max Return",    d: "Highest return"     },
  { id: "equal",       name: "Equal Weight",  d: "Simple 1/N"         },
];

// Ticker → Clearbit domain mapping for logo fetching
export const LOGOS = {
  // US Tech
  AAPL: "apple.com",       MSFT: "microsoft.com",   NVDA: "nvidia.com",
  GOOGL: "google.com",     GOOG: "google.com",       AMZN: "amazon.com",
  META: "meta.com",        TSLA: "tesla.com",        AVGO: "broadcom.com",
  ORCL: "oracle.com",      ADBE: "adobe.com",        NFLX: "netflix.com",
  AMD: "amd.com",          INTC: "intel.com",        QCOM: "qualcomm.com",
  CRM: "salesforce.com",   NOW: "servicenow.com",    INTU: "intuit.com",
  AMAT: "appliedmaterials.com", MU: "micron.com",    TXN: "ti.com",
  LRCX: "lamresearch.com", KLAC: "kla.com",          MRVL: "marvell.com",
  PANW: "paloaltonetworks.com", CRWD: "crowdstrike.com", SNPS: "synopsys.com",
  CDNS: "cadence.com",     FTNT: "fortinet.com",     PYPL: "paypal.com",
  UBER: "uber.com",        SPOT: "spotify.com",      PLTR: "palantir.com",
  COIN: "coinbase.com",    SNOW: "snowflake.com",     NET: "cloudflare.com",
  RBLX: "roblox.com",      HOOD: "robinhood.com",    SOFI: "sofi.com",
  NU: "nu.com.br",         MELI: "mercadolibre.com", SE: "sea.com",
  GRAB: "grab.com",        KSPI: "kaspi.kz",
  // Finance
  JPM: "jpmorgan.com",     V: "visa.com",            MA: "mastercard.com",
  BAC: "bankofamerica.com", WFC: "wellsfargo.com",   GS: "goldmansachs.com",
  MS: "morganstanley.com", BLK: "blackrock.com",     AXP: "americanexpress.com",
  SCHW: "schwab.com",      C: "citi.com",            COF: "capitalone.com",
  SPGI: "spglobal.com",
  // Healthcare
  LLY: "lilly.com",        UNH: "unitedhealthgroup.com", JNJ: "jnj.com",
  ABBV: "abbvie.com",      MRK: "merck.com",         TMO: "thermofisher.com",
  ABT: "abbott.com",       AMGN: "amgen.com",        DHR: "danaher.com",
  VRTX: "vrtx.com",        REGN: "regeneron.com",    ISRG: "intuitivesurgical.com",
  PFE: "pfizer.com",       MDT: "medtronic.com",     GILD: "gilead.com",
  // Consumer
  HD: "homedepot.com",     MCD: "mcdonalds.com",     NKE: "nike.com",
  SBUX: "starbucks.com",   TGT: "target.com",        COST: "costco.com",
  WMT: "walmart.com",      LOW: "lowes.com",          PG: "pg.com",
  KO: "coca-cola.com",     PEP: "pepsico.com",       PM: "pmi.com",
  MO: "altria.com",        CL: "colgatepalmolive.com",
  // Industrial & Energy
  CAT: "caterpillar.com",  DE: "deere.com",           BA: "boeing.com",
  GE: "ge.com",            HON: "honeywell.com",      UPS: "ups.com",
  RTX: "rtx.com",          LMT: "lockheedmartin.com", XOM: "exxonmobil.com",
  CVX: "chevron.com",      COP: "conocophillips.com", SLB: "slb.com",
  // European
  "SAP.DE": "sap.com",     "ASML.AS": "asml.com",    "BMW.DE": "bmw.com",
  "AZN.L": "astrazeneca.com", "HSBA.L": "hsbc.com",  "SHEL.L": "shell.com",
  "NESN.SW": "nestle.com", "NOVN.SW": "novartis.com", "LVMH.PA": "lvmh.com",
  "MC.PA": "lvmh.com",
};

export function filterTickers(query) {
  if (!query || query.length < 1) return [];
  const q = query.toUpperCase();
  const bySymbol = TICKERS.filter(t => t.s.startsWith(q));
  const byName   = TICKERS.filter(t => !t.s.startsWith(q) && t.n.toUpperCase().includes(q));
  return [...bySymbol, ...byName].slice(0, 8);
}

export const TICKERS = [
  // Mega-cap tech
  { s: "AAPL",  n: "Apple Inc." },
  { s: "MSFT",  n: "Microsoft Corp." },
  { s: "NVDA",  n: "NVIDIA Corp." },
  { s: "GOOGL", n: "Alphabet Inc. (Class A)" },
  { s: "GOOG",  n: "Alphabet Inc. (Class C)" },
  { s: "AMZN",  n: "Amazon.com Inc." },
  { s: "META",  n: "Meta Platforms Inc." },
  { s: "TSLA",  n: "Tesla Inc." },
  { s: "AVGO",  n: "Broadcom Inc." },
  { s: "ORCL",  n: "Oracle Corp." },
  { s: "ADBE",  n: "Adobe Inc." },
  { s: "NFLX",  n: "Netflix Inc." },
  { s: "AMD",   n: "Advanced Micro Devices" },
  { s: "INTC",  n: "Intel Corp." },
  { s: "QCOM",  n: "Qualcomm Inc." },
  { s: "CRM",   n: "Salesforce Inc." },
  { s: "NOW",   n: "ServiceNow Inc." },
  { s: "INTU",  n: "Intuit Inc." },
  { s: "AMAT",  n: "Applied Materials" },
  { s: "MU",    n: "Micron Technology" },
  { s: "TXN",   n: "Texas Instruments" },
  { s: "LRCX",  n: "Lam Research" },
  { s: "KLAC",  n: "KLA Corp." },
  { s: "MRVL",  n: "Marvell Technology" },
  { s: "PANW",  n: "Palo Alto Networks" },
  { s: "CRWD",  n: "CrowdStrike Holdings" },
  { s: "SNPS",  n: "Synopsys Inc." },
  { s: "CDNS",  n: "Cadence Design Systems" },
  { s: "FTNT",  n: "Fortinet Inc." },
  { s: "PYPL",  n: "PayPal Holdings" },
  { s: "UBER",  n: "Uber Technologies" },
  { s: "SPOT",  n: "Spotify Technology" },
  // US Growth / New economy
  { s: "PLTR",  n: "Palantir Technologies" },
  { s: "COIN",  n: "Coinbase Global" },
  { s: "SNOW",  n: "Snowflake Inc." },
  { s: "NET",   n: "Cloudflare Inc." },
  { s: "RBLX",  n: "Roblox Corp." },
  { s: "HOOD",  n: "Robinhood Markets" },
  { s: "SOFI",  n: "SoFi Technologies" },
  { s: "NU",    n: "Nu Holdings" },
  { s: "MELI",  n: "MercadoLibre Inc." },
  { s: "SE",    n: "Sea Limited" },
  { s: "GRAB",  n: "Grab Holdings" },
  { s: "KSPI",  n: "Kaspi.kz (Kazakhstan)" },
  // Finance
  { s: "BRK-B", n: "Berkshire Hathaway B" },
  { s: "JPM",   n: "JPMorgan Chase" },
  { s: "V",     n: "Visa Inc." },
  { s: "MA",    n: "Mastercard Inc." },
  { s: "BAC",   n: "Bank of America" },
  { s: "WFC",   n: "Wells Fargo" },
  { s: "GS",    n: "Goldman Sachs" },
  { s: "MS",    n: "Morgan Stanley" },
  { s: "BLK",   n: "BlackRock Inc." },
  { s: "AXP",   n: "American Express" },
  { s: "SCHW",  n: "Charles Schwab" },
  { s: "C",     n: "Citigroup Inc." },
  { s: "USB",   n: "U.S. Bancorp" },
  { s: "PGR",   n: "Progressive Corp." },
  { s: "COF",   n: "Capital One Financial" },
  { s: "SPGI",  n: "S&P Global Inc." },
  // Healthcare
  { s: "LLY",   n: "Eli Lilly and Co." },
  { s: "UNH",   n: "UnitedHealth Group" },
  { s: "JNJ",   n: "Johnson & Johnson" },
  { s: "ABBV",  n: "AbbVie Inc." },
  { s: "MRK",   n: "Merck & Co." },
  { s: "TMO",   n: "Thermo Fisher Scientific" },
  { s: "ABT",   n: "Abbott Laboratories" },
  { s: "AMGN",  n: "Amgen Inc." },
  { s: "DHR",   n: "Danaher Corp." },
  { s: "VRTX",  n: "Vertex Pharmaceuticals" },
  { s: "REGN",  n: "Regeneron Pharmaceuticals" },
  { s: "ISRG",  n: "Intuitive Surgical" },
  { s: "PFE",   n: "Pfizer Inc." },
  { s: "MDT",   n: "Medtronic plc" },
  { s: "GILD",  n: "Gilead Sciences" },
  // Consumer
  { s: "HD",    n: "Home Depot" },
  { s: "MCD",   n: "McDonald's Corp." },
  { s: "NKE",   n: "Nike Inc." },
  { s: "SBUX",  n: "Starbucks Corp." },
  { s: "TGT",   n: "Target Corp." },
  { s: "COST",  n: "Costco Wholesale" },
  { s: "WMT",   n: "Walmart Inc." },
  { s: "LOW",   n: "Lowe's Companies" },
  { s: "TJX",   n: "TJX Companies" },
  { s: "PG",    n: "Procter & Gamble" },
  { s: "KO",    n: "Coca-Cola Co." },
  { s: "PEP",   n: "PepsiCo Inc." },
  { s: "PM",    n: "Philip Morris" },
  { s: "MO",    n: "Altria Group" },
  { s: "CL",    n: "Colgate-Palmolive" },
  // Industrial & Energy
  { s: "CAT",   n: "Caterpillar Inc." },
  { s: "DE",    n: "Deere & Co." },
  { s: "BA",    n: "Boeing Co." },
  { s: "GE",    n: "GE Aerospace" },
  { s: "HON",   n: "Honeywell International" },
  { s: "UPS",   n: "United Parcel Service" },
  { s: "RTX",   n: "RTX Corp." },
  { s: "LMT",   n: "Lockheed Martin" },
  { s: "XOM",   n: "ExxonMobil Corp." },
  { s: "CVX",   n: "Chevron Corp." },
  { s: "COP",   n: "ConocoPhillips" },
  { s: "EOG",   n: "EOG Resources" },
  { s: "SLB",   n: "SLB" },
  // Real Estate & Utilities
  { s: "AMT",   n: "American Tower" },
  { s: "PLD",   n: "Prologis Inc." },
  { s: "NEE",   n: "NextEra Energy" },
  { s: "DUK",   n: "Duke Energy" },
  { s: "SO",    n: "Southern Co." },
  // European stocks (Yahoo Finance format)
  { s: "SAP.DE",  n: "SAP SE" },
  { s: "ASML.AS", n: "ASML Holding N.V." },
  { s: "BMW.DE",  n: "BMW AG" },
  { s: "AZN.L",   n: "AstraZeneca plc" },
  { s: "HSBA.L",  n: "HSBC Holdings" },
  { s: "SHEL.L",  n: "Shell plc" },
  { s: "NESN.SW", n: "Nestlé S.A." },
  { s: "NOVN.SW", n: "Novartis AG" },
  { s: "LVMH.PA", n: "LVMH Moët Hennessy" },
  { s: "MC.PA",   n: "LVMH (Euronext Paris)" },
  // ETFs
  { s: "SPY",   n: "SPDR S&P 500 ETF" },
  { s: "QQQ",   n: "Invesco QQQ ETF (Nasdaq 100)" },
  { s: "IWM",   n: "iShares Russell 2000 ETF" },
  { s: "VTI",   n: "Vanguard Total Stock Market" },
  { s: "VOO",   n: "Vanguard S&P 500 ETF" },
  { s: "VEA",   n: "Vanguard FTSE Developed Markets" },
  { s: "VWO",   n: "Vanguard FTSE Emerging Markets" },
  { s: "AGG",   n: "iShares Core U.S. Aggregate Bond" },
  { s: "BND",   n: "Vanguard Total Bond Market ETF" },
  { s: "GLD",   n: "SPDR Gold Shares ETF" },
  { s: "SLV",   n: "iShares Silver Trust" },
  { s: "TLT",   n: "iShares 20+ Year Treasury ETF" },
  { s: "HYG",   n: "iShares iBoxx High Yield Corp Bond" },
  { s: "XLK",   n: "Technology Select Sector SPDR" },
  { s: "XLF",   n: "Financial Select Sector SPDR" },
  { s: "XLV",   n: "Health Care Select Sector SPDR" },
  { s: "XLE",   n: "Energy Select Sector SPDR" },
  { s: "XLI",   n: "Industrial Select Sector SPDR" },
  { s: "XLY",   n: "Consumer Discretionary SPDR" },
  { s: "XLP",   n: "Consumer Staples SPDR" },
  { s: "ARKK",  n: "ARK Innovation ETF" },
  { s: "DIA",   n: "SPDR Dow Jones Industrial ETF" },
  { s: "EEM",   n: "iShares MSCI Emerging Markets" },
  { s: "EFA",   n: "iShares MSCI EAFE ETF" },
  { s: "VNQ",   n: "Vanguard Real Estate ETF" },
  // Crypto (Yahoo Finance format)
  { s: "BTC-USD",   n: "Bitcoin" },
  { s: "ETH-USD",   n: "Ethereum" },
  { s: "BNB-USD",   n: "Binance Coin" },
  { s: "SOL-USD",   n: "Solana" },
  { s: "XRP-USD",   n: "XRP" },
  { s: "ADA-USD",   n: "Cardano" },
  { s: "DOGE-USD",  n: "Dogecoin" },
  { s: "AVAX-USD",  n: "Avalanche" },
  { s: "LINK-USD",  n: "Chainlink" },
  { s: "DOT-USD",   n: "Polkadot" },
  { s: "MATIC-USD", n: "Polygon" },
  { s: "LTC-USD",   n: "Litecoin" },
];
