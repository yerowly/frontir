import os
import sys

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from core.data import calc_returns, get_prices

from regime_eval_common import pl_score, run_backtest


def main():
    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    start = "2016-01-01"
    end = "2024-12-31"

    thr_grid = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]
    conf_grid = [0.4, 0.45, 0.5, 0.55, 0.6]

    prices = get_prices(tickers, start=start, end=end)
    returns = calc_returns(prices)

    print("grid search: thr_mult x min_conf ranked by pl_score")
    print(f"tickers={tickers} period={start}->{end}")
    print("pl_score = CAGR_adj - 0.5*abs(max_dd) - 0.2*churn")
    print("note: using max_rebalances=60 for speed (approx, for ranking only)")
    print("-" * 80)

    rows = []
    n_total = len(thr_grid) * len(conf_grid)
    k = 0
    for tm in thr_grid:
        for mc in conf_grid:
            k += 1
            print(f"  {k}/{n_total} thr_mult={tm} min_conf={mc}", flush=True)
            bt = run_backtest(
                returns,
                thr_mult=tm,
                min_conf=mc,
                max_rebalances=60,
            )
            ps = pl_score(bt)
            rows.append((ps, tm, mc, bt))

    rows.sort(key=lambda x: -x[0])
    print("rank | pl_score | thr_mult | min_conf | CAGR_adj | max_dd   | churn")
    for i, (ps, tm, mc, bt) in enumerate(rows[:15]):
        print(
            f"{i+1:4d} | {ps:8.4f} | {tm:8.2f} | {mc:8.2f} | "
            f"{bt['annual_return_adj']:8.4f} | {bt['max_dd']:8.4f} | {bt['churn']:.4f}"
        )

    best = rows[0]
    print("-" * 80)
    print(
        f"BEST pl_score={best[0]:.4f} thr_mult={best[1]} min_conf={best[2]} "
        f"sharpe={best[3]['sharpe']:.4f}"
    )


if __name__ == "__main__":
    main()
