import streamlit as st
import pandas as pd
import numpy as np

from core.data import get_prices, calc_returns, annual_stats
from core.optimizer import optimize_portfolio, random_portfolios, STRATEGIES
from core.portfolio import Portfolio
from core.backtest import compare_all, results_table
from core.montecarlo import run_simulation, get_stats, get_percentile_paths
from core.taxes import TAX_PRESETS, calc_tax, tax_summary
from core.charts import (efficient_frontier, weights_pie, cumulative_chart,
                         drawdown_chart, correlation_heatmap, weights_comparison,
                         montecarlo_chart, montecarlo_distribution, tax_comparison_chart)


st.set_page_config(page_title="Portfolio Optimizer", layout="wide")
st.title("Portfolio Optimizer")

with st.sidebar:
    st.header("Settings")

    tickers_raw = st.text_input(
        "Tickers (comma separated)",
        value="AAPL, MSFT, GOOGL, AMZN, JPM, JNJ, GLD",
    )
    tickers = [t.strip().upper() for t in tickers_raw.split(",") if t.strip()]
    if len(tickers) > 20:
        st.warning("too many tickers (max 20), trimming")
        tickers = tickers[:20]

    col1, col2 = st.columns(2)
    start = col1.date_input("Start", value=pd.to_datetime("2020-01-01"))
    end = col2.date_input("End", value=pd.to_datetime("2024-12-31"))

    strategy = st.selectbox("Strategy", options=STRATEGIES)
    rf_rate = st.slider("Risk-free rate (%)", 0.0, 10.0, 4.5, 0.5) / 100

    st.subheader("Backtest")
    train_months = st.slider("Training window (months)", 6, 36, 12)
    rebalance = st.slider("Rebalance every (months)", 1, 6, 1)
    commission = st.slider("Commission per trade (%)", 0.0, 1.0, 0.1, 0.05) / 100

    st.subheader("Monte Carlo")
    initial_investment = st.number_input("Initial investment ($)", value=10000, step=1000)
    sim_days = st.slider("Simulation horizon (days)", 63, 756, 252, 63)
    n_simulations = st.slider("Number of simulations", 1000, 20000, 5000, 1000)

    st.subheader("Taxes")
    tax_regime = st.selectbox("Tax regime", options=list(TAX_PRESETS.keys()),
                              format_func=lambda x: TAX_PRESETS[x]["name"])
    holding_years = st.slider("Holding period (years)", 1, 10, 3)

    go_btn = st.button("Run", type="primary", use_container_width=True)

if go_btn:
    if len(tickers) < 2:
        st.error("need at least 2 tickers")
        st.stop()

    if n_simulations > 5000:
        st.warning("n_simulations too big, forcing 5000")
        n_simulations = 5000
    if sim_days > 1000:
        st.warning("sim_days too big, forcing 1000")
        sim_days = 1000

    with st.spinner("downloading data..."):
        try:
            prices = get_prices(tickers, str(start), str(end))
        except ValueError as e:
            st.error(str(e))
            st.stop()

    returns = calc_returns(prices)
    mu, cov = annual_stats(returns)

    st.success(f"loaded {len(prices)} days, {len(prices.columns)} assets")

    st.header("Optimal Portfolio")

    weights = optimize_portfolio(strategy, mu, cov, rf_rate)
    pf = Portfolio(weights, returns, rf_rate)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Return", f"{pf.annual_return():.2%}")
    c2.metric("Volatility", f"{pf.volatility():.2%}")
    c3.metric("Sharpe", f"{pf.sharpe():.3f}")
    c4.metric("Max Drawdown", f"{pf.max_drawdown():.2%}")

    left, right = st.columns([2, 1])

    with left:
        with st.spinner("generating frontier..."):
            rand_pf = random_portfolios(mu, cov, n_portfolios=5000, rf_rate=rf_rate)
            opt_points = {}
            for s in STRATEGIES:
                w = optimize_portfolio(s, mu, cov, rf_rate)
                p = Portfolio(w, returns, rf_rate)
                opt_points[s] = (p.volatility(), p.annual_return())
            st.plotly_chart(efficient_frontier(rand_pf, opt_points), use_container_width=True)

    with right:
        st.plotly_chart(weights_pie(weights, f"Weights: {strategy}"), use_container_width=True)

    left2, right2 = st.columns(2)
    with left2:
        st.plotly_chart(correlation_heatmap(returns), use_container_width=True)
    with right2:
        all_w = {s: optimize_portfolio(s, mu, cov, rf_rate) for s in STRATEGIES}
        st.plotly_chart(weights_comparison(all_w), use_container_width=True)

    st.header("Monte Carlo Simulation")

    with st.spinner("running simulation..."):
        paths = run_simulation(mu, cov, weights, initial_investment, sim_days, n_simulations)
        mc_stats = get_stats(paths)
        percentile_paths = get_percentile_paths(paths)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Median outcome", f"${mc_stats['median']:,.0f}",
              delta=f"{(mc_stats['median']/initial_investment - 1):+.1%}")
    c2.metric("95th percentile", f"${mc_stats['percentile_95']:,.0f}")
    c3.metric("5th percentile", f"${mc_stats['percentile_5']:,.0f}")
    c4.metric("Prob of loss", f"{mc_stats['prob_loss']:.1%}")

    left3, right3 = st.columns(2)
    with left3:
        st.plotly_chart(montecarlo_chart(percentile_paths, sim_days, initial_investment),
                       use_container_width=True)
    with right3:
        st.plotly_chart(montecarlo_distribution(paths), use_container_width=True)

    with st.expander("Detailed Monte Carlo stats"):
        mc_df = pd.DataFrame({
            "Metric": ["Mean", "Median", "Std Dev", "Min", "Max",
                       "5th percentile", "25th percentile",
                       "75th percentile", "95th percentile",
                       "Probability of loss",
                       "Prob gain >10%", "Prob gain >20%"],
            "Value": [
                f"${mc_stats['mean']:,.0f}",
                f"${mc_stats['median']:,.0f}",
                f"${mc_stats['std']:,.0f}",
                f"${mc_stats['min']:,.0f}",
                f"${mc_stats['max']:,.0f}",
                f"${mc_stats['percentile_5']:,.0f}",
                f"${mc_stats['percentile_25']:,.0f}",
                f"${mc_stats['percentile_75']:,.0f}",
                f"${mc_stats['percentile_95']:,.0f}",
                f"{mc_stats['prob_loss']:.1%}",
                f"{mc_stats['prob_gain_10']:.1%}",
                f"{mc_stats['prob_gain_20']:.1%}",
            ]
        })
        st.dataframe(mc_df, use_container_width=True, hide_index=True)

    st.header("Tax Analysis")

    expected_profit = mc_stats["median"] - initial_investment

    scenarios = []
    for regime_key in TAX_PRESETS:
        s = tax_summary(expected_profit, holding_years, regime_key)
        scenarios.append(s)

    left4, right4 = st.columns(2)

    with left4:
        st.plotly_chart(tax_comparison_chart(scenarios), use_container_width=True)

    with right4:
        # текущий режим
        current_tax = tax_summary(expected_profit, holding_years, tax_regime)
        preset = TAX_PRESETS[tax_regime]

        st.markdown(f"**Regime: {preset['name']}**")
        st.markdown(f"Holding period: {holding_years} years")
        st.markdown(f"Expected profit (median MC): **${expected_profit:,.0f}**")
        st.markdown(f"Tax: **${current_tax['tax']:,.0f}**")
        st.markdown(f"After tax: **${current_tax['after_tax']:,.0f}**")
        st.markdown(f"Effective rate: **{current_tax['effective_rate']}**")

        if tax_regime == "usa" and holding_years >= 1:
            st.info("Long-term capital gains rate (20%) applies after 1 year of holding")
        elif tax_regime == "kazakhstan":
            st.info("Kazakhstan: flat 10% on capital gains, 5% on dividends")

    st.header("Backtest")

    with st.spinner("running backtest..."):
        try:
            bt_results = compare_all(returns, train_months=train_months,
                                     rebalance_months=rebalance, rf_rate=rf_rate,
                                     commission=commission)
        except ValueError as e:
            st.error(str(e))
            st.stop()

    if bt_results:
        st.dataframe(results_table(bt_results), use_container_width=True, hide_index=True)
        st.plotly_chart(cumulative_chart(bt_results), use_container_width=True)

        selected = next((r for r in bt_results if r["strategy"] == strategy), None)
        if selected:
            st.plotly_chart(drawdown_chart(selected["cumulative"], f"Drawdown: {strategy}"),
                           use_container_width=True)
    else:
        st.warning("backtest empty, try longer period")

    st.header("Weights")
    w_df = pd.DataFrame(
        [(t, f"{w:.2%}") for t, w in sorted(weights.items(), key=lambda x: -x[1])],
        columns=["Ticker", "Weight"],
    )
    st.dataframe(w_df, use_container_width=True, hide_index=True)

else:
    st.info("Set parameters and press Run")
