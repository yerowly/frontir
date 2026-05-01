import yfinance as yf
import numpy as np
import pandas as pd
import os
import time
import sys


CACHE_DIR = ".cache"

def _p(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        try:
            sys.stdout.buffer.write((str(msg) + "\n").encode("utf-8", "backslashreplace"))
        except Exception:
            print(str(msg).encode("utf-8", "ignore").decode("utf-8"))


def get_prices(tickers, start="2020-01-01", end=None, cache=True):
    tickers = [t.upper().strip() for t in tickers]
    tickers = [t for t in tickers if t]

    cache_file = os.path.join(CACHE_DIR, "_".join(sorted(tickers)) + f"_{start}_{end}.csv")
    if cache and os.path.exists(cache_file):
        _p(f"[cache] загружаю из {cache_file}")
        return pd.read_csv(cache_file, index_col=0, parse_dates=True)

    raw = None
    if len(tickers) <= 5:
        _p(f"скачиваю данные: {tickers}")
        raw = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)
    else:
        _p(f"скачиваю данные пачками: {len(tickers)} tickers")
        parts = []
        for i in range(0, len(tickers), 5):
            batch = tickers[i:i+5]
            if i > 0:
                time.sleep(0.6)
            _p(f"  batch {i//5+1}: {batch}")
            r = yf.download(batch, start=start, end=end, auto_adjust=True, progress=False)
            parts.append(r)
        raw = pd.concat(parts, axis=1)

    if raw.empty:
        raise ValueError(f"нет данных для {tickers}, проверь тикеры")

    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        prices = raw[["Close"]]
        prices.columns = tickers

    bad = prices.columns[prices.isna().all()]
    if len(bad) > 0:
        _p(f"WARNING: нет данных для {list(bad)}, убираю")
        prices = prices.drop(columns=bad)

    if prices.empty:
        raise ValueError("после очистки не осталось данных")

    prices = prices.ffill().dropna()

    if cache:
        os.makedirs(CACHE_DIR, exist_ok=True)
        prices.to_csv(cache_file)

    return prices


def calc_returns(prices):
    return np.log(prices / prices.shift(1)).dropna()


def annual_stats(returns):
    mean_ret = returns.mean() * 252
    cov = returns.cov() * 252
    return mean_ret, cov
