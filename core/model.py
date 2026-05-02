import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score
from sklearn.utils.class_weight import compute_sample_weight
import pickle
import hashlib
import urllib.request

from core.data import annual_stats
from core.optimizer import optimize_portfolio, STRATEGIES
from core.portfolio import Portfolio


HERE = os.path.dirname(__file__)
MODEL_DIR = os.path.abspath(os.path.join(HERE, "..", "models"))


GOLDEN_SHA256 = "a120a4a294849624183a67e6ac88ee9156317e3565dfd1133381b9d9b7f41317"

# TODO: add VIX (or VIX9D) as a separate panic signal

MODEL_URL = os.environ.get(
    "MODEL_URL",
    "https://github.com/yerowly/frontir/releases/latest/download/regime_model.pkl",
)


def _sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _download_model(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    try:
        print(f"downloading model: {url}")
        urllib.request.urlretrieve(url, tmp)
        os.replace(tmp, path)
        print("download done")
        return True
    except Exception as e:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass
        print(f"model download failed: {e}")
        return False


def _safe_z(x, w=63):
    m = x.rolling(w).mean()
    s = x.rolling(w).std()
    return (x - m) / (s + 1e-8)


def make_features(returns, use_macro=True, use_news=False):
    port_ret = returns.mean(axis=1)
    cum = (1 + port_ret).cumprod()

    df = pd.DataFrame(index=returns.index)

    for w in [5, 10, 21, 63]:
        df[f"ret_{w}d"] = port_ret.rolling(w).mean()
        df[f"vol_{w}d"] = port_ret.rolling(w).std()

    df["ret_3d"] = port_ret.rolling(3).mean()
    df["vol_3d"] = port_ret.rolling(3).std()

    df["momentum_21"] = port_ret.rolling(21).sum()
    df["momentum_63"] = port_ret.rolling(63).sum()

    df["momentum_ratio_5_21"] = df["ret_5d"] / (df["ret_21d"] + 1e-8)
    df["momentum_acceleration"] = df["ret_5d"] - df["ret_21d"]

    df["vol_ratio"] = df["vol_5d"] / (df["vol_21d"] + 1e-8)

    rolling_max = cum.rolling(63).max()
    df["drawdown_63"] = (cum - rolling_max) / (rolling_max + 1e-8)

    h21 = cum.rolling(21).max()
    l21 = cum.rolling(21).min()
    df["dist_from_21d_high"] = (cum - h21) / (h21 + 1e-8)
    df["dist_from_21d_low"] = (cum - l21) / (l21 + 1e-8)

    h252 = cum.rolling(252).max()
    l252 = cum.rolling(252).min()
    df["dist_from_252d_high"] = (cum - h252) / (h252 + 1e-8)
    df["dist_from_252d_low"] = (cum - l252) / (l252 + 1e-8)

    df["pct_up_21"] = port_ret.rolling(21).apply(lambda x: (x > 0).mean())
    df["pct_up_63"] = port_ret.rolling(63).apply(lambda x: (x > 0).mean())

    df["ewm_ret_21"] = port_ret.ewm(span=21, adjust=False).mean()
    df["ewm_ret_5"] = port_ret.ewm(span=5, adjust=False).mean()
    df["ewm_vol_21"] = port_ret.ewm(span=21, adjust=False).std()

    if returns.shape[1] > 1:
        up_frac = (returns > 0).mean(axis=1)
        df["breadth_21"] = up_frac.rolling(21).mean()
        df["breadth_63"] = up_frac.rolling(63).mean()

        r5 = (1 + returns).rolling(5).apply(np.prod, raw=True) - 1
        r21 = (1 + returns).rolling(21).apply(np.prod, raw=True) - 1
        df["pct_positive_5d"] = (r5 > 0).mean(axis=1)
        df["pct_positive_21d"] = (r21 > 0).mean(axis=1)

        df["breadth_divergence"] = port_ret - returns.median(axis=1)

        disp = returns.std(axis=1)
        df["dispersion_1d"] = disp
        df["dispersion_5d"] = disp.rolling(5).mean()
        df["dispersion_21d"] = disp.rolling(21).mean()

    if returns.shape[1] > 1:
        corr_values = []
        for i in range(len(returns)):
            if i < 21:
                corr_values.append(np.nan)
                continue
            window = returns.iloc[i-21:i]
            corr = window.corr().values
            n = len(corr)
            upper = corr[np.triu_indices(n, k=1)]
            corr_values.append(np.nanmean(upper))
        df["mean_corr"] = corr_values
        mc = df["mean_corr"]
        df["corr_shock_21"] = mc - mc.rolling(21).mean()
        df["corr_z_63"] = _safe_z(mc, 63)

    df["vol_z_63"] = _safe_z(df["vol_21d"], 63)
    df["vol_of_vol_63"] = df["vol_21d"].rolling(63).std()

    v21 = df["vol_21d"]
    v21_m = v21.rolling(252).mean()
    v21_s = v21.rolling(252).std()
    df["vol_zscore"] = (v21 - v21_m) / (v21_s + 1e-8)
    df["vol_percentile"] = v21.rolling(252).apply(lambda x: float((x <= x[-1]).mean()), raw=True)

    avg_gain_21 = port_ret.clip(lower=0).rolling(21).mean()
    avg_loss_21 = (-port_ret.clip(upper=0)).rolling(21).mean()
    df["gain_loss_ratio_21"] = avg_gain_21 / (avg_loss_21 + 1e-8)

    df["skew_21"] = port_ret.rolling(21).skew()

    gains = port_ret.clip(lower=0).rolling(14).mean()
    losses = (-port_ret.clip(upper=0)).rolling(14).mean()
    df["rsi"] = gains / (gains + losses + 1e-8)

    if use_macro and returns.shape[1] > 1:
        cols = set(list(returns.columns))
        if "SPY" in cols and "TLT" in cols:
            spy = returns["SPY"]
            tlt = returns["TLT"]
            df["spy_tlt_spread_21"] = (spy - tlt).rolling(21).mean()
            df["spy_tlt_corr_63"] = spy.rolling(63).corr(tlt)

            spy21 = (1 + spy).rolling(21).apply(np.prod, raw=True)
            tlt21 = (1 + tlt).rolling(21).apply(np.prod, raw=True)
            df["stock_bond_ratio"] = spy21 / (tlt21 + 1e-8)

        if "HYG" in cols and "IEF" in cols:
            df["credit_spread_21"] = (returns["HYG"] - returns["IEF"]).rolling(21).mean()

        if "GLD" in cols:
            df["gold_momentum_21"] = returns["GLD"].rolling(21).sum()

    if use_news:
        # NOTE: news features must be aligned to dates (no lookahead).
        try:
            from core.news_features import merge_news_into_features
            df = merge_news_into_features(df)
        except Exception as e:
            print(f"news features skipped: {e}")

    return df.dropna()



def label_regimes(returns, forward_days=21, z=0.35, vol_window=21, panic_q=0.90, thr_mult=0.6):
    port_ret = returns.mean(axis=1)

    future_sum = port_ret.shift(-forward_days).rolling(forward_days).sum()
    future_std = port_ret.shift(-forward_days).rolling(forward_days).std()
    score = future_sum / (future_std * np.sqrt(forward_days) + 1e-8)

    # Adaptive threshold: wider in high-vol regimes, tighter in low-vol regimes.
    # Use a 252d rolling std of the forward-return signal; early period falls back to `z`.
    thr = score.rolling(252, min_periods=252).std() * float(thr_mult)
    if z is not None:
        thr = thr.fillna(float(z))

    labels = pd.Series(np.nan, index=returns.index)
    labels[score < -thr] = 0  # bear
    labels[score > thr] = 2   # bull
    labels[(score >= -thr) & (score <= thr)] = 1  # sideways

    vol_now = port_ret.rolling(vol_window).std()
    vol_thr = vol_now.expanding(min_periods=252).quantile(panic_q).shift(1)
    panic = vol_now > vol_thr
    labels[panic] = 3  # high-vol / panic

    return labels.dropna()


def make_walkforward_splits(n, n_splits=5, embargo=63):
    if n < 200:
        raise ValueError("too few samples for walkforward")

    splits = []
    cut_points = np.linspace(0, n, n_splits + 2).astype(int)

    for i in range(1, n_splits + 1):
        test_start = cut_points[i]
        test_end = cut_points[i + 1]

        train_end = test_start - embargo
        if train_end <= 50:
            continue

        train_idx = np.arange(0, train_end)
        test_idx = np.arange(test_start, test_end)
        if len(test_idx) == 0:
            continue
        splits.append((train_idx, test_idx))

    return splits


def label_best_strategy(returns, forward_days=21):

    labels = pd.Series(dtype=str, index=returns.index)
    dates = returns.index[::5]  

    print(f"  labeling best strategy for {len(dates)} dates...")

    for idx, date in enumerate(dates):
        if idx % 50 == 0:
            print(f"    {idx}/{len(dates)}")

        future = returns.loc[date:].head(forward_days)
        if len(future) < 10:
            continue

        past_start = date - pd.DateOffset(months=6)
        past = returns.loc[past_start:date]
        if len(past) < 60:
            continue

        mu, cov = annual_stats(past)

        best_sharpe = -999
        best_strat = "equal"

        for s in STRATEGIES:
            try:
                w = optimize_portfolio(s, mu, cov)
                w_arr = np.array([w.get(t, 0) for t in returns.columns])
                period_ret = future @ w_arr
                mean_r = period_ret.mean() * 252
                vol_r = period_ret.std() * np.sqrt(252)
                sharpe = mean_r / vol_r if vol_r > 0 else 0
                if sharpe > best_sharpe:
                    best_sharpe = sharpe
                    best_strat = s
            except:
                continue

        labels[date] = best_strat

    return labels.dropna()

class RegimeModel:

    def __init__(self):
        self.regime_model = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=10,
            random_state=42, n_jobs=-1, class_weight="balanced"
        )
        self.strategy_model = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=10,
            random_state=42, n_jobs=-1, class_weight="balanced"
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = None

    def _make_features(self, returns):
        use_news = bool(os.environ.get("NEWS_FEATURES_CSV"))
        if self.feature_names:
            use_news = use_news or any(str(x).startswith("news_") for x in self.feature_names)
        return make_features(returns, use_news=use_news)

    def train(self, returns, mode="regime", forward_days=21, embargo=None, n_splits=5, thr_mult=0.6):
        print("generating features...")
        features = self._make_features(returns)
        self.feature_names = list(features.columns)

        if mode == "regime":
            print("labeling regimes...")
            labels = label_regimes(returns, forward_days=forward_days, thr_mult=thr_mult)
        else:
            print("labeling best strategies (this takes a while)...")
            labels = label_best_strategy(returns)

        common_idx = features.index.intersection(labels.dropna().index)
        X = features.loc[common_idx]
        y = labels.loc[common_idx]

        print(f"training on {len(X)} samples, {len(X.columns)} features")

        if mode == "regime":
            print(f"class distribution:\n{y.value_counts().to_dict()}")

        X_scaled = self.scaler.fit_transform(X)

        if embargo is None:
            embargo = 63

        splits = make_walkforward_splits(len(X_scaled), n_splits=n_splits, embargo=embargo)
        scores = []

        for fold, (train_idx, test_idx) in enumerate(splits):
            X_train, X_test = X_scaled[train_idx], X_scaled[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

            if mode == "regime":
                self.regime_model.fit(X_train, y_train)
                pred = self.regime_model.predict(X_test)
            else:
                self.strategy_model.fit(X_train, y_train)
                pred = self.strategy_model.predict(X_test)

            f1 = f1_score(y_test, pred, average="macro")
            scores.append(f1)
            print(f"  fold {fold+1}: macro_f1 = {f1:.3f}")

        if scores:
            print(f"  mean macro_f1: {np.mean(scores):.3f}")
        else:
            print("  no valid splits (too short series?)")


        if mode == "regime":
            self.regime_model.fit(X_scaled, y)
        else:
            self.strategy_model.fit(X_scaled, y)

        self.is_trained = True
        print("done!")

        # feature importance
        if mode == "regime":
            imp = self.regime_model.feature_importances_
        else:
            imp = self.strategy_model.feature_importances_

        importance = sorted(zip(self.feature_names, imp), key=lambda x: -x[1])
        print("\ntop features:")
        for name, score in importance[:10]:
            bar = "#" * int(score * 100)
            print(f"  {name:20s} {score:.4f} {bar}")

    def predict_regime(self, returns):
        if not self.is_trained:
            raise ValueError("train() model first, dummy")

        features = self._make_features(returns)
        if len(features) == 0:
            return 1  # sideways по умолчанию

        if self.feature_names:
            features = features.reindex(columns=self.feature_names, fill_value=0)
        last_features = features.iloc[[-1]]
        X = self.scaler.transform(last_features)
        prediction = self.regime_model.predict(X)[0]

        regime_names = {0: "bear", 1: "sideways", 2: "bull", 3: "panic"}
        return regime_names.get(int(prediction), "sideways")

    def predict_regime_safe(self, returns, min_conf=0.4, smooth_days=0, hysteresis_days=0):
        from collections import Counter

        if not self.is_trained:
            return "sideways", {}

        features = self._make_features(returns)
        if len(features) == 0:
            return "sideways", {}

        if self.feature_names:
            features = features.reindex(columns=self.feature_names, fill_value=0)

        X = self.scaler.transform(features)
        probs_all = self.regime_model.predict_proba(X)
        classes = list(self.regime_model.classes_)
        regime_names = {0: "bear", 1: "sideways", 2: "bull", 3: "panic"}

        pred_cls = []
        for row in range(len(probs_all)):
            pr = probs_all[row]
            bi = int(np.argmax(pr))
            pred_cls.append(int(classes[bi]))

        sm = max(int(smooth_days), 1)
        hz = int(hysteresis_days)

        probs_last = probs_all[-1]
        conf = {regime_names.get(int(c), str(c)): float(p) for c, p in zip(classes, probs_last)}

        if hz > 1:
            tail_hz = pred_cls[-hz:]
            if len(set(tail_hz)) != 1:
                return "sideways", conf

        if sm > 1:
            win = pred_cls[-sm:]
            chosen_id = Counter(win).most_common(1)[0][0]
        else:
            chosen_id = pred_cls[-1]

        ix = None
        for j, c in enumerate(classes):
            if int(c) == int(chosen_id):
                ix = j
                break
        p_chosen = float(probs_last[ix]) if ix is not None else 0.0

        if p_chosen < float(min_conf):
            return "sideways", conf

        return regime_names.get(int(chosen_id), "sideways"), conf

    def predict_strategy(self, returns):
        if not self.is_trained:
            raise ValueError("model isnt trained")

        features = self._make_features(returns)
        if len(features) == 0:
            return "equal"

        if self.feature_names:
            features = features.reindex(columns=self.feature_names, fill_value=0)
        last_features = features.iloc[[-1]]
        X = self.scaler.transform(last_features)
        return self.strategy_model.predict(X)[0]

    def get_confidence(self, returns):
        features = self._make_features(returns)
        if len(features) == 0:
            return {}

        if self.feature_names:
            features = features.reindex(columns=self.feature_names, fill_value=0)
        last_features = features.iloc[[-1]]
        X = self.scaler.transform(last_features)
        probs = self.regime_model.predict_proba(X)[0]
        classes = self.regime_model.classes_

        regime_names = {0: "bear", 1: "sideways", 2: "bull", 3: "panic"}
        return {regime_names.get(int(c), str(c)): float(p) for c, p in zip(classes, probs)}

    def save(self, path=None):
        if path is None:
            os.makedirs(MODEL_DIR, exist_ok=True)
            path = os.path.join(MODEL_DIR, "regime_model.pkl")

        with open(path, "wb") as f:
            pickle.dump({
                "regime_model": self.regime_model,
                "strategy_model": self.strategy_model,
                "scaler": self.scaler,
                "feature_names": self.feature_names,
                "is_trained": self.is_trained,
            }, f)
        print(f"model saved: {path}")
        try:
            print(f"sha256: {_sha256_file(path)}")
        except Exception as e:
            print(f"sha256 calc failed: {e}")

    def load(self, path=None):
        if path is None:
            path = os.path.join(MODEL_DIR, "regime_model.pkl")

        if not os.path.exists(path):
            ok = _download_model(MODEL_URL, path)
            if not ok:
                raise ValueError("model missing and download failed")

        # check hash before unpickling (pickle = rce if file is swapped)
        got = _sha256_file(path)
        if got != GOLDEN_SHA256:
            print("[SECURITY] model sha256 mismatch, aborting load")
            print(f"  path: {path}")
            print(f"  got:  {got}")
            print(f"  need: {GOLDEN_SHA256}")
            try:
                os.remove(path)
                print("bad model deleted")
            except Exception:
                pass
            raise ValueError("model file hash mismatch")

        with open(path, "rb") as f:
            data = pickle.load(f)

        self.regime_model = data["regime_model"]
        self.strategy_model = data["strategy_model"]
        self.scaler = data["scaler"]
        self.feature_names = data["feature_names"]
        self.is_trained = data["is_trained"]
        print(f"model loaded: {path}")


def backtest_regime_switching(returns, train_months=24, rebalance_months=1,
                              rf_rate=0.045, commission=0.001, min_conf=0.4,
                              forward_days=21, z=0.35, vol_window=21, panic_q=0.90,
                              model_type="histgb", feats_all=None, labels_all=None,
                              max_rebalances=None, print_every=6,
                              thr_mult=0.6, smooth_days=0, hysteresis_days=0,
                              conf_entry=0.55, conf_exit=0.25):
    # walk-forward like core.backtest, but strategy chosen by regime
    dates = returns.index
    test_start = dates[0] + pd.DateOffset(months=train_months)

    if test_start >= dates[-1]:
        raise ValueError("not enough data")

    all_returns = []
    total_commission = 0
    turnovers = []
    current = test_start
    prev_weights = None
    n_reb = 0
    prev_rg = None

    regime_strategy = {
        "bull": "max_return",
        "bear": "min_var",
        "sideways": "risk_parity",
        "panic": "min_var",
    }

    def _make_clf():
        if model_type == "rf":
            return RandomForestClassifier(
                n_estimators=400, max_depth=6, min_samples_leaf=10,
                random_state=42, n_jobs=-1, class_weight="balanced"
            )
        if model_type == "histgb":
            return HistGradientBoostingClassifier(
                max_depth=3, learning_rate=0.08, max_iter=80, random_state=42
            )
        raise ValueError("bad model_type")

    def fit_fast(m, train):
        if feats_all is None:
            feats = make_features(train, use_news=bool(os.environ.get("NEWS_FEATURES_CSV")))
        else:
            feats = feats_all.loc[train.index[0]:train.index[-1]]

        if labels_all is None:
            labels = label_regimes(
                train,
                forward_days=forward_days,
                z=z,
                vol_window=vol_window,
                panic_q=panic_q,
                thr_mult=thr_mult,
            )
        else:
            labels = labels_all.loc[train.index[0]:train.index[-1]].dropna()

        idx = feats.index.intersection(labels.index)
        X = feats.loc[idx]
        y = labels.loc[idx]
        if len(X) < 200:
            return False
        Xs = m.scaler.fit_transform(X)
        m.regime_model = _make_clf()
        if model_type == "histgb":
            sw = compute_sample_weight("balanced", y)
            m.regime_model.fit(Xs, y, sample_weight=sw)
        else:
            m.regime_model.fit(Xs, y)
        m.is_trained = True
        m.feature_names = list(feats.columns)
        return True

    m = RegimeModel()

    while current < dates[-1]:
        if max_rebalances is not None and n_reb >= max_rebalances:
            break

        train_end = current
        train_start = train_end - pd.DateOffset(months=train_months)
        train = returns.loc[train_start:train_end]

        if len(train) < 60:
            current += pd.DateOffset(months=rebalance_months)
            continue

        ok = fit_fast(m, train)
        if not ok:
            current += pd.DateOffset(months=rebalance_months)
            continue

        if print_every and n_reb % int(print_every) == 0:
            print(f"  rebalance {n_reb}, date={str(current.date())}, train_days={len(train)}", flush=True)

        # decide regime on latest available slice (train)
        rg, conf = m.predict_regime_safe(
            train,
            min_conf=0.0,
            smooth_days=smooth_days,
            hysteresis_days=hysteresis_days,
        )

        # Two-threshold confidence gate:
        # - enter a new regime only if its prob >= conf_entry
        # - keep current regime while its prob >= conf_exit
        # This reduces churn without hard majority-vote lag.
        try:
            p_rg = float(conf.get(rg, 0.0))
        except Exception:
            p_rg = 0.0

        if prev_rg is None:
            if p_rg < float(conf_entry):
                rg = "sideways"
        else:
            if rg != prev_rg:
                if p_rg < float(conf_entry):
                    rg = prev_rg
            else:
                try:
                    p_prev = float(conf.get(prev_rg, 0.0))
                except Exception:
                    p_prev = 0.0
                if p_prev < float(conf_exit):
                    rg = "sideways"

        # Final global min_conf fallback (kept for backwards compatibility)
        try:
            if float(conf.get(rg, 0.0)) < float(min_conf):
                rg = "sideways"
        except Exception:
            pass

        prev_rg = rg
        strat = regime_strategy.get(rg, "max_sharpe")

        mu, cov = annual_stats(train)
        weights = optimize_portfolio(strat, mu, cov, rf_rate)

        turnover = 0.0
        if prev_weights is not None:
            turnover = sum(abs(weights.get(t, 0) - prev_weights.get(t, 0))
                          for t in set(list(weights.keys()) + list(prev_weights.keys())))
            if commission > 0:
                total_commission += turnover * commission
        turnovers.append(float(turnover))
        prev_weights = weights.copy()

        test_end = current + pd.DateOffset(months=rebalance_months)
        test = returns.loc[current:test_end]
        if len(test) == 0:
            current = test_end
            continue

        w = np.array([weights.get(t, 0) for t in returns.columns])
        period_ret = test @ w
        all_returns.append(period_ret)

        current = test_end
        n_reb += 1

    if not all_returns:
        raise ValueError("empty backtest")

    combined = pd.concat(all_returns)
    combined = combined[~combined.index.duplicated(keep="first")]
    cum = (1 + combined).cumprod()
    cum = cum * (1 - total_commission)

    ann_ret = combined.mean() * 252
    ann_vol = combined.std() * np.sqrt(252)
    sharpe = (ann_ret - rf_rate) / ann_vol if ann_vol > 0 else 0

    peak = cum.cummax()
    dd = ((cum - peak) / peak).min()

    years = max(len(combined) / 252.0, 1e-8)
    ann_ret_adj = (float(cum.iloc[-1]) ** (1.0 / years)) - 1.0
    churn = float(np.mean(turnovers)) if turnovers else 0.0

    return {
        "strategy": "regime_switching",
        "annual_return": float(ann_ret),
        "annual_return_adj": float(ann_ret_adj),
        "volatility": float(ann_vol),
        "sharpe": float(sharpe),
        "max_dd": float(dd),
        "total_commission": float(total_commission),
        "churn": float(churn),
        "cumulative": cum,
    }



def smart_optimize(returns, mean_ret, cov_mat, model=None, rf_rate=0.045):
    if model is not None and model.is_trained:
        regime, confidence = model.predict_regime_safe(returns, min_conf=0.4)

        regime_strategy = {
            "bull": "max_return",     
            "bear": "min_var",       
            "sideways": "risk_parity",
            "panic": "min_var",
        }

        strategy = regime_strategy.get(regime, "max_sharpe")
        print(f"  regime: {regime} (confidence: {confidence})")
        print(f"  strategy: {strategy}")
    else:
        strategy = "max_sharpe"
        regime = "unknown"
        confidence = {}

    weights = optimize_portfolio(strategy, mean_ret, cov_mat, rf_rate)

    return {
        "weights": weights,
        "strategy": strategy,
        "regime": regime,
        "confidence": confidence,
    }


if __name__ == "__main__":
    from core.data import get_prices, calc_returns

    print("=" * 60)
    print("TRAINING REGIME MODEL (histgb)")
    print("=" * 60)

    tickers = ["SPY", "QQQ", "IWM", "TLT", "GLD"]
    start = "2016-01-01"
    end = "2024-12-31"

    forward_days = 21
    z = 0.35

    print(f"tickers: {tickers}")
    print(f"period: {start} -> {end}")
    print(f"params: forward_days={forward_days}, z={z}")

    prices = get_prices(tickers, start=start, end=end)
    returns = calc_returns(prices)
    print(f"days: {len(returns)}")

    use_news = bool(os.environ.get("NEWS_FEATURES_CSV"))
    feats = make_features(returns, use_news=use_news)
    labels = label_regimes(returns, forward_days=forward_days, z=z, thr_mult=0.6)
    idx = feats.index.intersection(labels.index)
    X = feats.loc[idx]
    y = labels.loc[idx]

    print(f"samples: {len(X)}, feats: {X.shape[1]}")
    print(f"classes: {y.value_counts().to_dict()}")

    m = RegimeModel()
    Xs = m.scaler.fit_transform(X)

    m.regime_model = HistGradientBoostingClassifier(
        max_depth=3, learning_rate=0.08, max_iter=250, random_state=42
    )
    sw = compute_sample_weight("balanced", y)
    m.regime_model.fit(Xs, y, sample_weight=sw)

    m.feature_names = list(feats.columns)
    m.is_trained = True

    m.save()
    print("done. copy sha256 above into GOLDEN_SHA256")