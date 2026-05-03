# Frontir

Small personal project for portfolio optimization + backtesting.

- Backend: FastAPI (`api.py`)
- Frontends:
  - React (`frontend/`) talks to the backend at `REACT_APP_API_URL` (or `http://localhost:8000`)
  - Streamlit (`app.py`) is a simple legacy UI
- Core logic: `core/*.py`

This app is built on math + a trained ML model. **Not financial advice.** Results can be wrong.

## Quick run

### Backend (FastAPI)

From the repo root:

```bash
python api.py
```

Or:

```bash
uvicorn api:app --reload --port 8000
```

Health check: `GET /api/health`

### Frontend (React)

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3000`.

#### Frontend API URL

By default the frontend uses `http://localhost:8000`.

To point it to a deployed backend, set:

- `REACT_APP_API_URL=https://frontir.onrender.com`

### Streamlit (optional)

```bash
streamlit run app.py
```

## Regime model (ML)

- Code: `core/model.py`
- Model file: `models/regime_model.pkl`
- **Classifier:** the shipped checkpoint is trained as a **Histogram-based Gradient Boosting** model (`HistGradientBoostingClassifier` in scikit-learn). Training runs when you execute `python -m core/model.py` (see the `__main__` block at the bottom of `core/model.py`).
- Features are built from your portfolio returns (and optional macro / news columns): momentum and volatility over several windows, breadth, drawdown, RSI-like signals, multi-asset dispersion, etc.
- Regimes:
  - `0=bear`, `1=sideways`, `2=bull`, `3=panic`
- Label defaults used in training: `forward_days=21`, `z=0.35`

### Train / retrain the model

```bash
python -m core.model
```

It saves the model to `models/regime_model.pkl` and prints the file SHA-256 hash.

### Important security note (pickle)

The app **refuses to load** `models/regime_model.pkl` unless its SHA-256 matches `GOLDEN_SHA256` in `core/model.py`.

So after retraining:
- run `python -m core.model`
- copy the printed sha256
- paste it into `GOLDEN_SHA256`

### “Out of the box” model download (GitHub Releases)

If `models/regime_model.pkl` is missing, the backend will try to download it from:

- `MODEL_URL` (env var), or
- the default `MODEL_URL` inside `core/model.py` (GitHub `releases/latest/download/regime_model.pkl`)

It still does the same SHA-256 check (and deletes the file if the hash is wrong).

## API bounds (anti-DoS)

Some endpoints have hard limits on inputs (tickers count, Monte Carlo sizes, etc.). If you hit a 400, reduce the numbers.

## Cloudflare (optional, custom domain)

Cloudflare sits in front of your DNS and can proxy HTTP(S) (orange cloud) for DDoS filtering and CDN. The app does not need code changes; you wire **DNS + SSL** and update env vars.

### 1. Add the domain in Cloudflare

- Create a Cloudflare account (the **Free** plan is enough to start).
- **Add a site** → enter your domain → Cloudflare will scan existing DNS.
- At your **domain registrar**, replace the nameservers with the pair Cloudflare shows (this is what actually “connects” the domain to Cloudflare).

### 2. DNS records (typical: Netlify front + Render API)

Exact targets come from Netlify / Render dashboards when you add custom hostnames.

| Name | Type | Target (example) | Proxy |
|------|------|------------------|-------|
| `www` | CNAME | `your-site.netlify.app` | Proxied (orange) |
| `@` (apex) | CNAME or A | Per Netlify docs (flattening / ALIAS) | Proxied if supported |
| `api` | CNAME | `your-service.onrender.com` | Proxied (orange) |

In Render and Netlify, add the **same hostnames** as custom domains and complete their DNS checks.

### 3. SSL/TLS mode in Cloudflare

- Use **Full** or **Full (strict)** so HTTPS between browser ↔ Cloudflare ↔ origin works. Both Netlify and Render serve HTTPS on the origin.
- Avoid **Flexible** with HTTPS origins (often causes redirect loops or odd errors).

### 4. Env vars after you move to `https://yourdomain…`

- **Netlify (build)**: `REACT_APP_API_URL=https://api.yourdomain.com` (or your API hostname).
- **Render**: `ALLOW_ORIGINS=https://yourdomain.com,https://www.yourdomain.com` (comma-separated, full URLs, no trailing slash issues if you match how the browser sends `Origin`).

CORS does not replace authentication; it only affects browser cross-origin calls.

## Dev notes

- Don’t commit `venv/`, `.cache/`, etc.
- You probably don’t want to commit random retrained models either.

