import os
import sys

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.data import calc_returns, get_prices
from core.model import backtest_regime_switching


def pr(tag, bt):
    print(
        tag,
        "CAGR_adj",
        round(bt["annual_return_adj"], 4),
        "maxDD",
        round(bt["max_dd"], 4),
        "churn",
        round(bt["churn"], 4),
        "sharpe",
        round(bt["sharpe"], 4),
    )


def main():
    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    prices = get_prices(tickers, start="2016-01-01", end="2024-12-31")
    rets = calc_returns(prices)

    thr_mult = 0.6
    min_conf = 0.4
    max_rebalances = 200

    print("compare stabilization options")
    print(f"thr_mult={thr_mult} min_conf={min_conf} max_rebalances={max_rebalances}")

    base = backtest_regime_switching(
        rets,
        thr_mult=thr_mult,
        min_conf=min_conf,
        max_rebalances=max_rebalances,
        print_every=0,
    )
    sm = backtest_regime_switching(
        rets,
        thr_mult=thr_mult,
        min_conf=min_conf,
        smooth_days=5,
        max_rebalances=max_rebalances,
        print_every=0,
    )
    hz = backtest_regime_switching(
        rets,
        thr_mult=thr_mult,
        min_conf=min_conf,
        hysteresis_days=3,
        max_rebalances=max_rebalances,
        print_every=0,
    )
    both = backtest_regime_switching(
        rets,
        thr_mult=thr_mult,
        min_conf=min_conf,
        smooth_days=5,
        hysteresis_days=3,
        max_rebalances=max_rebalances,
        print_every=0,
    )

    pr("base", base)
    pr("smooth5", sm)
    pr("hyst3", hz)
    pr("both", both)


if __name__ == "__main__":
    main()

