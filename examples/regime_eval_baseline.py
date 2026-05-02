import os
import sys

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from core.data import calc_returns, get_prices

from regime_eval_common import (
    build_xy,
    pl_score,
    run_backtest,
    walkforward_macro_f1,
)


def main():
    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    start = "2016-01-01"
    end = "2024-12-31"
    forward_days = 21
    z_fallback = 0.35
    thr_mult = float(os.environ.get("THR_MULT", "0.6"))
    embargo = 63
    n_splits = 5

    use_news = bool(os.environ.get("NEWS_FEATURES_CSV"))
    min_conf = float(os.environ.get("MIN_CONF", "0.4"))

    prices = get_prices(tickers, start=start, end=end)
    returns = calc_returns(prices)

    print("=" * 72)
    print("BASELINE: walk-forward macro-F1 + rolling backtest P&L")
    print("=" * 72)
    print(f"tickers={tickers}")
    print(f"period={start} -> {end}")
    print(f"thr_mult={thr_mult}, min_conf={min_conf}, forward_days={forward_days}, z_fallback={z_fallback}")
    print(f"use_news={use_news}, embargo={embargo}, n_splits={n_splits}")
    print("-" * 72)

    X, y = build_xy(returns, forward_days, z_fallback, thr_mult, use_news=use_news)
    print(f"samples={len(X)}, n_features={X.shape[1]}")
    print(f"class_dist={y.value_counts().sort_index().to_dict()}")

    m_f1, s_f1, nfd = walkforward_macro_f1(X, y, n_splits=n_splits, embargo=embargo)
    print(f"walk_forward macro_f1 mean={m_f1:.4f} std={s_f1:.4f} folds={nfd}")

    print("-" * 72)
    print("backtest_regime_switching (same thr_mult, configured min_conf)")
    bt = run_backtest(returns, thr_mult=thr_mult, min_conf=min_conf, max_rebalances=None)
    ps = pl_score(bt)
    print(
        f"CAGR_adj={bt['annual_return_adj']:.4f} ann_ret={bt['annual_return']:.4f} "
        f"vol={bt['volatility']:.4f} sharpe={bt['sharpe']:.4f}"
    )
    print(f"max_dd={bt['max_dd']:.4f} churn={bt['churn']:.4f} commission={bt['total_commission']:.6f}")
    print(f"pl_score(cagr - 0.5*mdd - 0.2*churn)={ps:.4f}")

    print("-" * 72)
    print("optional: smooth_days=5 (majority vote)")
    bt2 = run_backtest(
        returns,
        thr_mult=thr_mult,
        min_conf=min_conf,
        smooth_days=5,
        hysteresis_days=0,
        max_rebalances=None,
    )
    print(
        f"CAGR_adj={bt2['annual_return_adj']:.4f} max_dd={bt2['max_dd']:.4f} "
        f"churn={bt2['churn']:.4f} pl_score={pl_score(bt2):.4f}"
    )


if __name__ == "__main__":
    main()
