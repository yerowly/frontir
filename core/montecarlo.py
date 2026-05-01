import numpy as np
import pandas as pd


def run_simulation(mean_ret, cov_mat, weights, initial_value=10000, days=252, n_simulations=5000):
    
    tickers = [t for t in mean_ret.index if t in weights]
    w = np.array([weights[t] for t in tickers])

    daily_mean = mean_ret[tickers].values / 252
    daily_cov = cov_mat.loc[tickers, tickers].values / 252

    port_daily_mean = w @ daily_mean
    port_daily_vol = np.sqrt(w @ daily_cov @ w)

    np.random.seed(None)
    all_paths = np.zeros((n_simulations, days + 1))
    all_paths[:, 0] = initial_value

    for i in range(n_simulations):
        daily_returns = np.random.normal(port_daily_mean, port_daily_vol, days)
        price_path = initial_value * np.cumprod(1 + daily_returns)
        all_paths[i, 1:] = price_path

    return all_paths


def get_stats(paths):
    final_values = paths[:, -1]
    initial = paths[0, 0]

    return {
        "initial": initial,
        "mean": float(np.mean(final_values)),
        "median": float(np.median(final_values)),
        "std": float(np.std(final_values)),
        "min": float(np.min(final_values)),
        "max": float(np.max(final_values)),
        "percentile_5": float(np.percentile(final_values, 5)),
        "percentile_25": float(np.percentile(final_values, 25)),
        "percentile_75": float(np.percentile(final_values, 75)),
        "percentile_95": float(np.percentile(final_values, 95)),
        "prob_loss": float(np.mean(final_values < initial)),
        "prob_gain_10": float(np.mean(final_values > initial * 1.10)),
        "prob_gain_20": float(np.mean(final_values > initial * 1.20)),
    }


def get_percentile_paths(paths, percentiles=[5, 25, 50, 75, 95]):
    result = {}
    for p in percentiles:
        result[p] = np.percentile(paths, p, axis=0)
    return result


def get_histogram(paths, bins=40):
    final_values = paths[:, -1]
    p1  = float(np.percentile(final_values, 1))
    p99 = float(np.percentile(final_values, 99))
    clipped = final_values[(final_values >= p1) & (final_values <= p99)]
    hist, edges = np.histogram(clipped, bins=bins)
    return {
        "counts": hist.tolist(),
        "edges":  [round(float(e), 2) for e in edges],
    }
