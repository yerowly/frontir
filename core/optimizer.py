import numpy as np
import pandas as pd
from scipy.optimize import minimize


STRATEGIES = ["equal", "min_var", "max_sharpe", "risk_parity", "max_return"]


def optimize_portfolio(strategy, mean_ret, cov_mat, rf_rate=0.045, target_vol=None):
    tickers = list(mean_ret.index)
    n = len(tickers)
    mu = mean_ret.values
    cov = cov_mat.values

    if strategy == "equal":
        w = np.ones(n) / n

    elif strategy == "min_var":
        w = _solve(n, cov, lambda w: w @ cov @ w)

    elif strategy == "max_sharpe":
        def neg_sharpe(w):
            ret = w @ mu
            vol = np.sqrt(w @ cov @ w)
            if vol == 0:
                return 0
            return -(ret - rf_rate) / vol
        w = _solve(n, cov, neg_sharpe)

    elif strategy == "risk_parity":
        target_rc = 1.0 / n
        def rc_objective(w):
            vol = np.sqrt(w @ cov @ w)
            if vol == 0:
                return 0
            marginal = cov @ w
            rc = w * marginal / vol
            return np.sum((rc - target_rc) ** 2)
        w = _solve(n, cov, rc_objective, min_weight=0.001)

    elif strategy == "max_return":
        if target_vol is None:
            eq = np.ones(n) / n
            target_vol = np.sqrt(eq @ cov @ eq)

        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1},
            {"type": "ineq", "fun": lambda w: target_vol - np.sqrt(w @ cov @ w)},
        ]
        res = minimize(lambda w: -(w @ mu), np.ones(n) / n,
                       method="SLSQP", bounds=[(0, 1)] * n, constraints=constraints)
        w = res.x
    else:
        raise ValueError(f"unknown strategy: {strategy}")

    return dict(zip(tickers, w))


def _solve(n, cov, objective, min_weight=0.0):

    constraints = {"type": "eq", "fun": lambda w: np.sum(w) - 1}
    bounds = [(min_weight, 1)] * n
    res = minimize(objective, np.ones(n) / n, method="SLSQP",
                   bounds=bounds, constraints=constraints)
    if not res.success:
        print(f"w: optim: {res.message}")
    return res.x


def random_portfolios(mean_ret, cov_mat, n_portfolios=10000, rf_rate=0.045):

    n = len(mean_ret)
    mu = mean_ret.values
    cov = cov_mat.values
    tickers = list(mean_ret.index)

    results = []
    for _ in range(n_portfolios):
        w = np.random.dirichlet(np.ones(n))
        ret = w @ mu
        vol = np.sqrt(w @ cov @ w)
        sharpe = (ret - rf_rate) / vol if vol > 0 else 0
        results.append([ret, vol, sharpe] + list(w))

    cols = ["return", "volatility", "sharpe"] + tickers
    return pd.DataFrame(results, columns=cols)
