import os

import pandas as pd


def load_news_daily(index):
    path = os.environ.get("NEWS_FEATURES_CSV")
    if not path or not os.path.exists(path):
        return pd.DataFrame(
            {"news_sent": 0.0, "news_vol": 0.0},
            index=index,
        )

    raw = pd.read_csv(path, index_col=0, parse_dates=True)
    raw = raw.sort_index()
    if "news_sent" not in raw.columns:
        raw["news_sent"] = 0.0
    if "news_vol" not in raw.columns:
        raw["news_vol"] = 0.0

    out = raw[["news_sent", "news_vol"]].reindex(index)
    out = out.ffill().fillna(0.0)
    return out


def merge_news_into_features(df):
    n = load_news_daily(df.index)
    out = df.copy()
    s = n["news_sent"].reindex(df.index).fillna(0.0)
    v = n["news_vol"].reindex(df.index).fillna(0.0)
    out["news_sent_1d"] = s
    out["news_vol_1d"] = v
    out["news_sent_5d"] = s.rolling(5, min_periods=1).mean()
    out["news_sent_21d"] = s.rolling(21, min_periods=1).mean()
    return out
