from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from urllib.parse import quote
import numpy as np
import pandas as pd
import os

from core.data import get_prices, calc_returns, annual_stats
from core.optimizer import optimize_portfolio, random_portfolios, STRATEGIES
from core.portfolio import Portfolio
from core.backtest import compare_all
from core.montecarlo import run_simulation, get_stats, get_percentile_paths, get_histogram
from core.taxes import TAX_PRESETS, tax_summary
from core.model import RegimeModel, smart_optimize

app = FastAPI(title="Frontir API", version="2.0")

def _cors_origins():
    raw = os.environ.get("ALLOW_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    parts = [p.strip() for p in raw.split(",")]
    out = []
    for p in parts:
        if not p:
            continue
        if not p.startswith("http://") and not p.startswith("https://"):
            print(f"[cors] bad origin (need full url): {p}")
            continue
        out.append(p.rstrip("/"))
    return out if out else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

regime_model = RegimeModel()
HERE = os.path.dirname(__file__)
MODEL_PATH = os.path.abspath(os.path.join(HERE, "models", "regime_model.pkl"))
try:
    regime_model.load(MODEL_PATH)
    print(f"[startup] model loaded from {MODEL_PATH}")
except Exception as e:
    print(f"[startup] failed to load model: {e}")


@app.exception_handler(RequestValidationError)
async def _validation_err(req, exc):
    print(f"[validation] {exc}")
    return JSONResponse(status_code=422, content={"detail": "bad request"})


@app.exception_handler(Exception)
async def _any_err(req, exc):
    print(f"[error] {exc}")
    return JSONResponse(status_code=500, content={"detail": "server error"})


class PricesRequest(BaseModel):
    tickers: list
    start: str = "2020-01-01"
    end: str = "2024-12-31"


class OptimizeRequest(BaseModel):
    tickers: list
    start: str = "2020-01-01"
    end: str = "2024-12-31"
    strategy: str = "max_sharpe"
    rf_rate: float = 0.045


class BacktestRequest(BaseModel):
    tickers: list
    start: str = "2020-01-01"
    end: str = "2024-12-31"
    strategies: list = None
    train_months: int = 12
    rebalance_months: int = 1
    rf_rate: float = 0.045
    commission: float = 0.001


class MonteCarloRequest(BaseModel):
    tickers: list
    start: str = "2020-01-01"
    end: str = "2024-12-31"
    strategy: str = "max_sharpe"
    rf_rate: float = 0.045
    initial_investment: float = 10000
    sim_days: int = 252
    n_simulations: int = 5000


class TaxRequest(BaseModel):
    profit: float
    holding_years: int = 3
    regime: str = "kazakhstan"


class RegimeRequest(BaseModel):
    tickers: list
    start: str = "2020-01-01"
    end: str = "2024-12-31"


class FrontierRequest(BaseModel):
    tickers: list
    start: str = "2020-01-01"
    end: str = "2024-12-31"
    rf_rate: float = 0.045
    n_portfolios: int = 3000



def _load_data(tickers, start, end):
    tickers = [t.strip().upper() for t in tickers if t.strip()]
    if len(tickers) < 2:
        raise HTTPException(400, "bad request")
    if len(tickers) > 20:
        raise HTTPException(400, "too many tickers")
    try:
        prices = get_prices(tickers, start=start, end=end)
    except ValueError as e:
        print(f"[data] {e}")
        raise HTTPException(400, "failed to load data")
    returns = calc_returns(prices)
    return prices, returns




@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_loaded": regime_model.is_trained,
        "strategies": STRATEGIES,
        "tax_regimes": {k: v["name"] for k, v in TAX_PRESETS.items()},
    }


@app.post("/api/prices")
def get_price_data(req: PricesRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)

    return {
        "tickers": list(prices.columns),
        "days": len(prices),
        "start": str(prices.index[0].date()),
        "end": str(prices.index[-1].date()),
        "prices": {
            col: {
                "dates": [str(d.date()) for d in prices.index],
                "values": prices[col].round(2).tolist(),
            }
            for col in prices.columns
        },
    }


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)
    mu, cov = annual_stats(returns)

    if req.strategy not in STRATEGIES:
        raise HTTPException(400, "bad request")

    weights = optimize_portfolio(req.strategy, mu, cov, req.rf_rate)
    pf = Portfolio(weights, returns, req.rf_rate)

    cum = pf.cumulative()

    return {
        "strategy": req.strategy,
        "weights": {k: round(float(v), 4) for k, v in weights.items()},
        "metrics": {
            "annual_return": round(pf.annual_return(), 4),
            "volatility": round(pf.volatility(), 4),
            "sharpe": round(pf.sharpe(), 4),
            "sortino": round(pf.sortino(), 4),
            "max_drawdown": round(pf.max_drawdown(), 4),
            "var_95": round(pf.var95(), 6),
        },
        "cumulative": {
            "dates": [str(d.date()) for d in cum.index],
            "values": cum.round(4).tolist(),
        },
    }


@app.post("/api/optimize/all")
def optimize_all(req: OptimizeRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)
    mu, cov = annual_stats(returns)

    results = {}
    for strategy in STRATEGIES:
        weights = optimize_portfolio(strategy, mu, cov, req.rf_rate)
        pf = Portfolio(weights, returns, req.rf_rate)
        results[strategy] = {
            "weights": {k: round(float(v), 4) for k, v in weights.items()},
            "metrics": {
                "annual_return": round(pf.annual_return(), 4),
                "volatility": round(pf.volatility(), 4),
                "sharpe": round(pf.sharpe(), 4),
                "max_drawdown": round(pf.max_drawdown(), 4),
            },
        }

    return {"strategies": results}


@app.post("/api/frontier")
def frontier(req: FrontierRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)
    mu, cov = annual_stats(returns)

    if req.n_portfolios > 5000:
        raise HTTPException(400, "n_portfolios too large")

    rand_pf = random_portfolios(mu, cov, n_portfolios=req.n_portfolios, rf_rate=req.rf_rate)

    opt_points = {}
    for s in STRATEGIES:
        w = optimize_portfolio(s, mu, cov, req.rf_rate)
        p = Portfolio(w, returns, req.rf_rate)
        opt_points[s] = {
            "volatility": round(p.volatility(), 4),
            "return": round(p.annual_return(), 4),
            "sharpe": round(p.sharpe(), 4),
        }

    return {
        "random_portfolios": {
            "returns": rand_pf["return"].round(4).tolist(),
            "volatilities": rand_pf["volatility"].round(4).tolist(),
            "sharpes": rand_pf["sharpe"].round(4).tolist(),
        },
        "optimal": opt_points,
    }


@app.post("/api/backtest")
def backtest(req: BacktestRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)

    strategies = req.strategies or STRATEGIES

    try:
        bt_results = compare_all(
            returns,
            strategies=strategies,
            train_months=req.train_months,
            rebalance_months=req.rebalance_months,
            rf_rate=req.rf_rate,
            commission=req.commission,
        )
    except ValueError as e:
        print(f"[backtest] {e}")
        raise HTTPException(400, "bad request")

    if not bt_results:
        raise HTTPException(400, "backtest empty, try longer period")

    results = []
    for r in bt_results:
        cum = r["cumulative"]
        results.append({
            "strategy": r["strategy"],
            "annual_return": round(r["annual_return"], 4),
            "volatility": round(r["volatility"], 4),
            "sharpe": round(r["sharpe"], 4),
            "max_drawdown": round(r["max_dd"], 4),
            "total_commission": round(r.get("total_commission", 0), 4),
            "cumulative": {
                "dates": [str(d.date()) for d in cum.index],
                "values": cum.round(4).tolist(),
            },
        })

    return {"results": results}


@app.post("/api/montecarlo")
def montecarlo(req: MonteCarloRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)
    mu, cov = annual_stats(returns)

    if req.n_simulations > 5000:
        raise HTTPException(400, "n_simulations too large")
    if req.sim_days > 1000:
        raise HTTPException(400, "sim_days too large")
    if req.strategy not in STRATEGIES:
        raise HTTPException(400, "bad request")

    weights = optimize_portfolio(req.strategy, mu, cov, req.rf_rate)
    paths = run_simulation(
        mu, cov, weights,
        initial_value=req.initial_investment,
        days=req.sim_days,
        n_simulations=req.n_simulations,
    )

    stats = get_stats(paths)
    percentile_paths = get_percentile_paths(paths)

    return {
        "stats": {k: round(float(v), 2) if isinstance(v, float) else v for k, v in stats.items()},
        "percentiles": {
            str(p): values.round(2).tolist()
            for p, values in percentile_paths.items()
        },
        "histogram": get_histogram(paths),
        "params": {
            "strategy": req.strategy,
            "initial_investment": req.initial_investment,
            "sim_days": req.sim_days,
            "n_simulations": req.n_simulations,
        },
    }


@app.post("/api/taxes")
def taxes(req: TaxRequest):
    if req.regime not in TAX_PRESETS:
        raise HTTPException(400, "bad request")

    result = tax_summary(req.profit, req.holding_years, req.regime)

    all_regimes = []
    for key in TAX_PRESETS:
        s = tax_summary(req.profit, req.holding_years, key)
        all_regimes.append(s)

    return {
        "current": result,
        "comparison": all_regimes,
        "presets": {k: v["name"] for k, v in TAX_PRESETS.items()},
    }


@app.post("/api/regime")
def predict_regime(req: RegimeRequest):
    if not regime_model.is_trained:
        raise HTTPException(503, "model not trained. run: python -m core.model")

    prices, returns = _load_data(req.tickers, req.start, req.end)
    mu, cov = annual_stats(returns)

    regime = regime_model.predict_regime(returns)
    confidence = regime_model.get_confidence(returns)
    result = smart_optimize(returns, mu, cov, regime_model)

    return {
        "regime": regime,
        "confidence": {k: round(float(v), 4) for k, v in confidence.items()},
        "recommended_strategy": result["strategy"],
        "weights": {k: round(float(v), 4) for k, v in result["weights"].items()},
    }


@app.post("/api/correlation")
def correlation(req: PricesRequest):
    prices, returns = _load_data(req.tickers, req.start, req.end)
    corr = returns.corr()

    return {
        "tickers": list(corr.columns),
        "matrix": corr.round(4).values.tolist(),
    }


@app.get("/api/search")
def search_tickers(q: str):
    import requests
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
        "Origin": "https://finance.yahoo.com",
    }
    q2 = quote(q or "", safe="")
    url = f"/v1/finance/search?q={q2}&quotesCount=10&newsCount=0&enableFuzzyQuery=false"
    for base in ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]:
        try:
            resp = requests.get(base + url, headers=headers, timeout=5)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            continue
    raise HTTPException(502, "Yahoo Finance search unavailable")


# TODO: dockerize this (api + frontend) for release


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)