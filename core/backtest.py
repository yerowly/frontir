import numpy as np
import pandas as pd

from core.data import annual_stats
from core.optimizer import optimize_portfolio, STRATEGIES
from core.portfolio import Portfolio


def backtest(returns, strategy, train_months=12, rebalance_months=1,
             rf_rate=0.045, commission=0.001):
    dates = returns.index
    test_start = dates[0] + pd.DateOffset(months=train_months)

    if test_start >= dates[-1]:
        raise ValueError(f"мало данных, нужно минимум {train_months} мес для обучения")

    all_returns = []
    rebalance_dates = []
    total_commission = 0
    current = test_start
    prev_weights = None

    while current < dates[-1]:
        train_end = current
        train_start = train_end - pd.DateOffset(months=train_months)
        train = returns.loc[train_start:train_end]

        if len(train) < 20:
            current += pd.DateOffset(months=rebalance_months)
            continue

        mu, cov = annual_stats(train)
        weights = optimize_portfolio(strategy, mu, cov, rf_rate)

        if prev_weights is not None and commission > 0:
            turnover = sum(abs(weights.get(t, 0) - prev_weights.get(t, 0))
                          for t in set(list(weights.keys()) + list(prev_weights.keys())))
            total_commission += turnover * commission
        prev_weights = weights.copy()

        test_end = current + pd.DateOffset(months=rebalance_months)
        test = returns.loc[current:test_end]

        if len(test) == 0:
            current = test_end
            continue

        w = np.array([weights.get(t, 0) for t in returns.columns])
        period_ret = test @ w
        all_returns.append(period_ret)
        rebalance_dates.append(str(current.date()))

        current = test_end

    if not all_returns:
        raise ValueError("бэктест пустой, увеличь период данных")

    combined = pd.concat(all_returns)
    combined = combined[~combined.index.duplicated(keep="first")]
    cum = (1 + combined).cumprod()

    cum = cum * (1 - total_commission)

    ann_ret = combined.mean() * 252
    ann_vol = combined.std() * np.sqrt(252)
    sharpe = (ann_ret - rf_rate) / ann_vol if ann_vol > 0 else 0

    peak = cum.cummax()
    dd = ((cum - peak) / peak).min()

    return {
        "strategy": strategy,
        "cumulative": cum,
        "annual_return": float(ann_ret),
        "volatility": float(ann_vol),
        "sharpe": float(sharpe),
        "max_dd": float(dd),
        "total_commission": float(total_commission),
        "rebalance_dates": rebalance_dates,
    }


def compare_all(returns, strategies=None, **kwargs):
    if strategies is None:
        strategies = STRATEGIES

    results = []
    for s in strategies:
        print(f"  backtest: {s}...")
        try:
            res = backtest(returns, s, **kwargs)
            results.append(res)
        except Exception as e:
            print(f"  ERROR в {s}: {e}")

    return results


def results_table(results):
    """таблица сравнения"""
    rows = []
    for r in results:
        rows.append({
            "strategy": r["strategy"],
            "annual_return": f"{r['annual_return']:.2%}",
            "volatility": f"{r['volatility']:.2%}",
            "sharpe": f"{r['sharpe']:.3f}",
            "max_drawdown": f"{r['max_dd']:.2%}",
            "commissions": f"{r['total_commission']:.2%}",
        })
    return pd.DataFrame(rows)
