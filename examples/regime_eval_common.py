import os
import sys

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import f1_score
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_sample_weight

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.model import backtest_regime_switching, label_regimes, make_features, make_walkforward_splits


def walkforward_macro_f1(X, y, n_splits=5, embargo=63):
    splits = make_walkforward_splits(len(X), n_splits=n_splits, embargo=embargo)
    f1s = []
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
    if not f1s:
        return float("nan"), float("nan"), 0
    return float(np.mean(f1s)), float(np.std(f1s)), len(f1s)


def pl_score(bt, w_dd=0.5, w_churn=0.2):
    cagr = float(bt["annual_return_adj"])
    mdd = abs(float(bt["max_dd"]))
    churn = float(bt["churn"])
    return cagr - w_dd * mdd - w_churn * churn


def run_backtest(returns, thr_mult, min_conf, smooth_days=0, hysteresis_days=0,
                 train_months=24, rebalance_months=1, commission=0.001, max_rebalances=60):
    return backtest_regime_switching(
        returns,
        train_months=train_months,
        rebalance_months=rebalance_months,
        commission=commission,
        min_conf=min_conf,
        thr_mult=thr_mult,
        smooth_days=smooth_days,
        hysteresis_days=hysteresis_days,
        max_rebalances=max_rebalances,
        print_every=0,
    )


def build_xy(returns, forward_days, z_fallback, thr_mult, use_news=False):
    feats = make_features(returns, use_news=use_news)
    labels = label_regimes(
        returns,
        forward_days=forward_days,
        z=z_fallback,
        thr_mult=thr_mult,
    )
    idx = feats.index.intersection(labels.index)
    return feats.loc[idx], labels.loc[idx]
