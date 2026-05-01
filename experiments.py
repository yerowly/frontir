import numpy as np
import pandas as pd
import os
from datetime import datetime

from core.data import get_prices, calc_returns
from core.model import backtest_regime_switching, make_features, label_regimes


LOG_FILE = "experiments.csv"

ETF_CORE = ["SPY", "QQQ", "IWM", "TLT", "GLD"]


def _save_row(row):
    df_new = pd.DataFrame([row])
    if os.path.exists(LOG_FILE):
        df_old = pd.read_csv(LOG_FILE)
        df = pd.concat([df_old, df_new], ignore_index=True)
    else:
        df = df_new
    df.to_csv(LOG_FILE, index=False)


def run_grid(start="2016-01-01", end="2024-12-31", rf_rate=0.045,
             train_months=24, rebalance_months=3, commission=0.001, min_conf=0.45,
             max_rebalances=None):
    z_list = [0.15, 0.25, 0.35]
    fwd_list = [21, 42, 63]

    print(f"tickers: {ETF_CORE}")
    prices = get_prices(ETF_CORE, start=start, end=end)
    returns = calc_returns(prices)
    print(f"days: {len(returns)}")

    feats_all = make_features(returns)

    for fwd in fwd_list:
        for z in z_list:
            print("\n" + "-" * 60)
            print(f"run: forward_days={fwd}, z={z}")

            labels_all = label_regimes(returns, forward_days=fwd, z=z)

            res = backtest_regime_switching(
                returns,
                train_months=train_months,
                rebalance_months=rebalance_months,
                rf_rate=rf_rate,
                commission=commission,
                min_conf=min_conf,
                forward_days=fwd,
                z=z,
                model_type="histgb",
                feats_all=feats_all,
                labels_all=labels_all,
                max_rebalances=max_rebalances,
                print_every=4,
            )

            row = {
                "ts": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "z_score": float(z),
                "forward_days": int(fwd),
                "sharpe": round(res.get("sharpe", 0.0), 4),
                "max_drawdown": round(res.get("max_dd", 0.0), 4),
                "return_annual": round(res.get("annual_return_adj", 0.0), 4),
                "churn_rate": round(res.get("churn", 0.0), 4),
                "total_commission": round(res.get("total_commission", 0.0), 4),
            }

            print(f"sharpe={row['sharpe']}, dd={row['max_drawdown']}, ann={row['return_annual']}, churn={row['churn_rate']}")
            _save_row(row)


def show_results():
    if not os.path.exists(LOG_FILE):
        print("no experiments yet")
        return

    df = pd.read_csv(LOG_FILE)
    df = df.sort_values("sharpe", ascending=False)

    print("\n" + "=" * 80)
    print("ALL RUNS (sorted by sharpe)")
    print("=" * 80)

    for _, r in df.iterrows():
        print(f"\n  z={r['z_score']}, fwd={int(r['forward_days'])}")
        print(f"    sharpe={r['sharpe']:.3f}  ann={r['return_annual']:.2%}  dd={r['max_drawdown']:.2%}  churn={r['churn_rate']:.3f}")

    best = df.iloc[0]
    print(f"\nBEST: z={best['z_score']}, fwd={int(best['forward_days'])}, sharpe={best['sharpe']:.3f}")


if __name__ == "__main__":
    run_grid(rebalance_months=3)
    show_results()