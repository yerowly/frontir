import numpy as np
import pandas as pd
import pytest

from core.portfolio import Portfolio
from core.optimizer import optimize_portfolio, STRATEGIES


@pytest.fixture
def fake_returns():
    """синтетические данные для тестов"""
    np.random.seed(42)
    dates = pd.date_range("2022-01-01", periods=500, freq="B")
    return pd.DataFrame({
        "AAPL": np.random.normal(0.0005, 0.02, 500),
        "MSFT": np.random.normal(0.0004, 0.018, 500),
        "GOOGL": np.random.normal(0.0003, 0.022, 500),
    }, index=dates)


@pytest.fixture
def stats(fake_returns):
    mu = fake_returns.mean() * 252
    cov = fake_returns.cov() * 252
    return mu, cov


def test_return_is_finite(fake_returns):
    w = {"AAPL": 0.5, "MSFT": 0.3, "GOOGL": 0.2}
    p = Portfolio(w, fake_returns)
    assert np.isfinite(p.annual_return())


def test_vol_positive(fake_returns):
    w = {"AAPL": 0.5, "MSFT": 0.3, "GOOGL": 0.2}
    p = Portfolio(w, fake_returns)
    assert p.volatility() > 0


def test_drawdown_negative(fake_returns):
    w = {"AAPL": 0.5, "MSFT": 0.3, "GOOGL": 0.2}
    p = Portfolio(w, fake_returns)
    assert p.max_drawdown() <= 0


def test_summary_keys(fake_returns):
    w = {"AAPL": 1/3, "MSFT": 1/3, "GOOGL": 1/3}
    p = Portfolio(w, fake_returns)
    s = p.summary()
    assert "return" in s
    assert "sharpe" in s


def test_all_strategies_weights_sum_to_one(stats):
    mu, cov = stats
    for s in STRATEGIES:
        w = optimize_portfolio(s, mu, cov)
        assert abs(sum(w.values()) - 1.0) < 1e-5, f"{s}: weights dont sum to 1"


def test_no_negative_weights(stats):
    mu, cov = stats
    for s in STRATEGIES:
        w = optimize_portfolio(s, mu, cov)
        assert all(v >= -1e-6 for v in w.values()), f"{s}: has negative weights"


def test_equal_is_actually_equal(stats):
    mu, cov = stats
    w = optimize_portfolio("equal", mu, cov)
    vals = list(w.values())
    assert all(abs(v - vals[0]) < 1e-10 for v in vals)


def test_min_var_less_volatile_than_equal(fake_returns, stats):
    mu, cov = stats
    eq = Portfolio(optimize_portfolio("equal", mu, cov), fake_returns)
    mv = Portfolio(optimize_portfolio("min_var", mu, cov), fake_returns)
    assert mv.volatility() <= eq.volatility() + 1e-6
