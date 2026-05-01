# Portfolio Optimizer

Small personal project for portfolio optimization + backtesting.

- Backend: FastAPI (`api.py`)
- Frontends:
  - React (`frontend/`) talks to the backend at `http://localhost:8000`
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

### Streamlit (optional)

```bash
streamlit run app.py
```

## Regime model (ML)

- Code: `core/model.py`
- Model file: `models/regime_model.pkl`
- Regimes:
  - `0=bear`, `1=sideways`, `2=bull`, `3=panic`
- Label defaults (current best): `forward_days=21`, `z=0.35`

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

## Dev notes

- Don’t commit `venv/`, `.cache/`, etc.
- You probably don’t want to commit random retrained models either.

