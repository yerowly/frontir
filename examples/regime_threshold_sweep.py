import os
import sys

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import f1_score, recall_score
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_sample_weight

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.data import calc_returns, get_prices
from core.model import label_regimes, make_features, make_walkforward_splits


def _eval_walkforward(X, y, thr_mult, n_splits=5, embargo=63):
    splits = make_walkforward_splits(len(X), n_splits=n_splits, embargo=embargo)
    f1s = []
    bear_recalls = []

    for train_idx, test_idx in splits:
        X_train = X.iloc[train_idx]
        y_train = y.iloc[train_idx]
        X_test = X.iloc[test_idx]
        y_test = y.iloc[test_idx]

        sc = StandardScaler()
        Xtr = sc.fit_transform(X_train)
        Xte = sc.transform(X_test)

        m = HistGradientBoostingClassifier(
            max_depth=3, learning_rate=0.08, max_iter=250, random_state=42
        )
        sw = compute_sample_weight("balanced", y_train)
        m.fit(Xtr, y_train, sample_weight=sw)
        pred = m.predict(Xte)

        f1s.append(float(f1_score(y_test, pred, average="macro")))
        bear_recalls.append(float(recall_score(y_test, pred, labels=[0], average="macro", zero_division=0)))

    return {
        "thr_mult": float(thr_mult),
        "n_folds": int(len(f1s)),
        "macro_f1_mean": float(np.mean(f1s)) if f1s else float("nan"),
        "macro_f1_std": float(np.std(f1s)) if f1s else float("nan"),
        "bear_recall_mean": float(np.mean(bear_recalls)) if bear_recalls else float("nan"),
        "bear_recall_std": float(np.std(bear_recalls)) if bear_recalls else float("nan"),
    }


def main():
    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    start = "2016-01-01"
    end = "2024-12-31"

    forward_days = 21
    z_fallback = 0.35
    embargo = 63
    n_splits = 5

    thr_grid = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]

    prices = get_prices(tickers, start=start, end=end)
    returns = calc_returns(prices)

    feats = make_features(returns)

    print("sweep adaptive threshold multiplier")
    print(f"tickers={tickers}")
    print(f"period={start} -> {end}")
    print(f"forward_days={forward_days}, z_fallback={z_fallback}, embargo={embargo}, n_splits={n_splits}")
    print(f"samples (features)={len(feats)}, n_features={feats.shape[1]}")
    print("-" * 70)

    rows = []
    for k in thr_grid:
        labels = label_regimes(
            returns,
            forward_days=forward_days,
            z=z_fallback,
            thr_mult=k,
        )
        idx = feats.index.intersection(labels.index)
        X = feats.loc[idx]
        y = labels.loc[idx]

        r = _eval_walkforward(X, y, k, n_splits=n_splits, embargo=embargo)
        rows.append(r)
        print(
            f"thr_mult={k:.2f} | folds={r['n_folds']} | macro_f1={r['macro_f1_mean']:.4f}+/-{r['macro_f1_std']:.4f} | bear_recall={r['bear_recall_mean']:.4f}+/-{r['bear_recall_std']:.4f}"
        )

    best = sorted(rows, key=lambda x: (-x["macro_f1_mean"], x["macro_f1_std"]))[0]
    print("-" * 70)
    print(
        f"best by macro_f1: thr_mult={best['thr_mult']:.2f} macro_f1={best['macro_f1_mean']:.4f}+/-{best['macro_f1_std']:.4f}"
    )


if __name__ == "__main__":
    main()

