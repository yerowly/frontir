import os
import sys
import warnings

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from core.data import calc_returns, get_prices

from regime_eval_common import pl_score
from core.model import backtest_regime_switching


def main():
    warnings.filterwarnings("ignore")
    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    prices = get_prices(tickers, start="2016-01-01", end="2024-12-31")
    returns = calc_returns(prices)

    thr_mult = float(os.environ.get("THR_MULT", "0.6"))
    min_conf = float(os.environ.get("MIN_CONF", "0.4"))
    max_rebalances = int(os.environ.get("MAX_REBALANCES", "120"))

    reb_grid = [1, 2, 3]
    entry_grid = [0.5, 0.55, 0.6]
    exit_grid = [0.25, 0.35, 0.45]

    print("sweep execution knobs: rebalance_months x conf_entry x conf_exit")
    print(f"thr_mult={thr_mult} min_conf={min_conf}")
    print("pl_score = CAGR_adj - 0.5*abs(max_dd) - 0.2*churn")
    print("-" * 96)

    rows = []
    n_total = len(reb_grid) * len(entry_grid) * len(exit_grid)
    k = 0
    for reb in reb_grid:
        for ce in entry_grid:
            for cx in exit_grid:
                k += 1
                print(f"  {k}/{n_total} reb_m={reb} entry={ce} exit={cx}", flush=True)
                bt = backtest_regime_switching(
                    returns,
                    thr_mult=thr_mult,
                    min_conf=min_conf,
                    rebalance_months=reb,
                    conf_entry=ce,
                    conf_exit=cx,
                    max_rebalances=max_rebalances,
                    print_every=0,
                )
                ps = pl_score(bt)
                rows.append((ps, reb, ce, cx, bt))

    rows.sort(key=lambda x: -x[0])
    print("rank | pl_score | reb_m | entry | exit  | CAGR_adj | max_dd   | churn  | sharpe")
    for i, (ps, reb, ce, cx, bt) in enumerate(rows[:12]):
        print(
            f"{i+1:4d} | {ps:8.4f} | {reb:5d} | {ce:5.2f} | {cx:5.2f} | "
            f"{bt['annual_return_adj']:8.4f} | {bt['max_dd']:8.4f} | {bt['churn']:6.4f} | {bt['sharpe']:.4f}"
        )

    best = rows[0]
    print("-" * 96)
    print(
        f"BEST pl_score={best[0]:.4f} rebalance_months={best[1]} conf_entry={best[2]} conf_exit={best[3]} "
        f"CAGR_adj={best[4]['annual_return_adj']:.4f} max_dd={best[4]['max_dd']:.4f} churn={best[4]['churn']:.4f}"
    )


if __name__ == "__main__":
    main()

