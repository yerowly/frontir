import os
import sys

import numpy as np

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from core.data import calc_returns, get_prices
from core.model import label_regimes, make_features

from regime_eval_common import walkforward_macro_f1


def main():
    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    start = "2016-01-01"
    end = "2024-12-31"
    forward_days = 21
    z_fallback = 0.35
    embargo = 63
    n_splits = 5

    dense_grid = list(np.arange(0.65, 0.76, 0.02))

    use_news = bool(os.environ.get("NEWS_FEATURES_CSV"))

    prices = get_prices(tickers, start=start, end=end)
    returns = calc_returns(prices)
    feats = make_features(returns, use_news=use_news)

    print("dense thr_mult sweep (0.65 .. 0.75 step 0.02): walk-forward macro-F1")
    print(f"samples use_news={use_news}")
    print("thr_mult | macro_f1 mean +/- std | folds | panic_pct")
    print("-" * 72)

    for i, k in enumerate(dense_grid):
        print(f"  {i+1}/{len(dense_grid)} thr_mult={k:.2f}", flush=True)
        labels = label_regimes(
            returns,
            forward_days=forward_days,
            z=z_fallback,
            thr_mult=float(k),
        )
        idx = feats.index.intersection(labels.index)
        X = feats.loc[idx]
        y = labels.loc[idx]
        m_f1, s_f1, nfd = walkforward_macro_f1(X, y, n_splits=n_splits, embargo=embargo)
        panic_pct = float((y == 3.0).mean()) if len(y) else 0.0
        print(
            f"{k:.2f}     | {m_f1:.4f}+/-{s_f1:.4f}      | {nfd}     | {panic_pct:.3f}"
        )

    print("-" * 72)
    ref_mult = 0.7
    labels = label_regimes(
        returns,
        forward_days=forward_days,
        z=z_fallback,
        thr_mult=ref_mult,
    )
    yr = labels.groupby(labels.index.year)
    print(f"class counts by year (thr_mult={ref_mult}):")
    for year, ser in yr:
        vc = ser.value_counts().sort_index()
        panic_n = int(vc.get(3.0, 0))
        tot = int(len(ser))
        print(f"  {year}: n={tot} dist={vc.to_dict()} panic_share={panic_n/max(tot,1):.3f}")


if __name__ == "__main__":
    main()
