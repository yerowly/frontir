import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px


def efficient_frontier(rand_pf, opt_points):
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=rand_pf["volatility"],
        y=rand_pf["return"],
        mode="markers",
        marker=dict(size=5, color=rand_pf["sharpe"], colorscale="Viridis", showscale=True),
        name="random",
    ))

    for s in opt_points:
        vol, ret = opt_points[s]
        fig.add_trace(go.Scatter(
            x=[vol], y=[ret],
            mode="markers+text",
            text=[s],
            textposition="top center",
            marker=dict(size=12),
            name=s,
        ))

    fig.update_layout(
        xaxis_title="volatility",
        yaxis_title="return",
        margin=dict(l=20, r=20, t=30, b=20),
        legend=dict(orientation="h"),
    )
    return fig


def weights_pie(weights, title="weights"):
    items = sorted(weights.items(), key=lambda x: -x[1])
    labels = [k for k, v in items if v > 0.0001]
    vals = [float(v) for k, v in items if v > 0.0001]
    fig = px.pie(names=labels, values=vals, title=title, hole=0.4)
    fig.update_layout(margin=dict(l=10, r=10, t=40, b=10))
    return fig


def cumulative_chart(results):
    fig = go.Figure()
    for r in results:
        cum = r["cumulative"]
        fig.add_trace(go.Scatter(x=cum.index, y=cum.values, mode="lines", name=r["strategy"]))
    fig.update_layout(
        yaxis_title="cumulative",
        margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(orientation="h"),
    )
    return fig


def drawdown_chart(cum, title="drawdown"):
    peak = cum.cummax()
    dd = (cum - peak) / peak
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=dd.index, y=dd.values, mode="lines", name="dd"))
    fig.update_layout(title=title, yaxis_title="drawdown", margin=dict(l=20, r=20, t=40, b=20))
    return fig


def correlation_heatmap(returns):
    corr = returns.corr()
    fig = px.imshow(
        corr.values,
        x=list(corr.columns),
        y=list(corr.index),
        color_continuous_scale="RdBu",
        zmin=-1, zmax=1,
    )
    fig.update_layout(margin=dict(l=20, r=20, t=20, b=20))
    return fig


def weights_comparison(all_w):
    tickers = sorted({t for s in all_w for t in all_w[s]})
    data = []
    for s in all_w:
        row = {"strategy": s}
        for t in tickers:
            row[t] = float(all_w[s].get(t, 0))
        data.append(row)
    df = pd.DataFrame(data).set_index("strategy")
    fig = px.bar(df, barmode="group")
    fig.update_layout(margin=dict(l=20, r=20, t=20, b=20), yaxis_title="weight")
    return fig


def montecarlo_chart(percentile_paths, sim_days, initial_value):
    fig = go.Figure()
    x = list(range(sim_days + 1))
    for p in sorted(percentile_paths.keys()):
        fig.add_trace(go.Scatter(x=x, y=percentile_paths[p], mode="lines", name=f"p{p}"))
    fig.update_layout(margin=dict(l=20, r=20, t=20, b=20), yaxis_title="value")
    return fig


def montecarlo_distribution(paths):
    final_vals = paths[:, -1]
    fig = px.histogram(x=final_vals, nbins=50)
    fig.update_layout(margin=dict(l=20, r=20, t=20, b=20), xaxis_title="final value", yaxis_title="count")
    return fig


def tax_comparison_chart(scenarios):
    df = pd.DataFrame(scenarios)
    fig = px.bar(df, x="regime", y="after_tax")
    fig.update_layout(margin=dict(l=20, r=20, t=20, b=20), yaxis_title="after tax")
    return fig