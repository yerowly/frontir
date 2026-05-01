import numpy as np
import pandas as pd


class Portfolio:
    def __init__(self, weights, returns, rf_rate=0.045):
        self.weights = weights
        self.rf_rate = rf_rate

        tickers = [t for t in returns.columns if t in weights]
        self.w = np.array([weights[t] for t in tickers])
        self.ret = returns[tickers]

        self.mean = self.ret.mean() * 252
        self.cov = self.ret.cov() * 252

    def annual_return(self):
        return float(self.w @ self.mean)

    def volatility(self):
        return float(np.sqrt(self.w @ self.cov @ self.w))

    def sharpe(self):
        vol = self.volatility()
        if vol == 0:
            return 0
        return (self.annual_return() - self.rf_rate) / vol

    def sortino(self):
        daily = self.ret @ self.w
        downside = daily[daily < 0]
        down_std = downside.std() * np.sqrt(252)
        if down_std == 0:
            return 0
        return (self.annual_return() - self.rf_rate) / down_std

    def daily_returns(self):
        return self.ret @ self.w

    def cumulative(self):
        return (1 + self.daily_returns()).cumprod()

    def max_drawdown(self):
        cum = self.cumulative()
        peak = cum.cummax()
        dd = (cum - peak) / peak
        return float(dd.min())

    def var95(self):
        """daily VaR 95%"""
        return float(np.percentile(self.daily_returns(), 5))

    def summary(self):
        """все метрики в dict"""
        return {
            "return": f"{self.annual_return():.2%}",
            "volatility": f"{self.volatility():.2%}",
            "sharpe": f"{self.sharpe():.3f}",
            "sortino": f"{self.sortino():.3f}",
            "max_dd": f"{self.max_drawdown():.2%}",
            "var_95": f"{self.var95():.4f}",
        }
