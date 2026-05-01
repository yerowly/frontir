"""
пример работы без streamlit
запуск: python -m examples.demo
"""

from core.data import get_prices, calc_returns, annual_stats
from core.optimizer import optimize_portfolio, STRATEGIES
from core.portfolio import Portfolio


def main():
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "JPM", "JNJ"]
    print(f"downloading: {tickers}")
    prices = get_prices(tickers, start="2021-01-01", end="2024-12-31")
    print(f"got {len(prices)} days\n")

    returns = calc_returns(prices)
    mu, cov = annual_stats(returns)

    print("=" * 60)
    for s in STRATEGIES:
        weights = optimize_portfolio(s, mu, cov)
        pf = Portfolio(weights, returns)

        print(f"\n{s.upper()}")
        print("-" * 40)

        for ticker, w in sorted(weights.items(), key=lambda x: -x[1]):
            if w > 0.01:
                bar = "#" * int(w * 40)
                print(f"  {ticker:5s} {w:6.2%}  {bar}")

        print()
        for k, v in pf.summary().items():
            print(f"  {k:15s}: {v}")

    print("\n" + "=" * 60)
    print("for dashboard: streamlit run app.py")


if __name__ == "__main__":
    main()
