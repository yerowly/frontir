TAX_PRESETS = {
    "kazakhstan": {
        "name": "Казахстан (ИПН)",
        "short_term_rate": 0.10,       # 10% ИПН на прирост капитала
        "long_term_rate": 0.10,        # нет льготы за срок владения
        "long_term_years": 99,         # нет long-term льготы
        "has_ldv": False,
        "ldv_per_year": 0,
        "dividend_rate": 0.05,         # 5% на дивиденды для резидентов
    },
    "usa": {
        "name": "USA",
        "short_term_rate": 0.37,       # ordinary income (макс ставка)
        "long_term_rate": 0.20,        # long term capital gains
        "long_term_years": 1,          # после 1 года - long term
        "has_ldv": False,
        "ldv_per_year": 0,
        "dividend_rate": 0.15,
    },
    "none": {
        "name": "No tax",
        "short_term_rate": 0.0,
        "long_term_rate": 0.0,
        "long_term_years": 1,
        "has_ldv": False,
        "ldv_per_year": 0,
        "dividend_rate": 0.0,
    },
}

# TODO: add KASE assets + local tax presets


def calc_tax(profit, holding_years, regime="kazakhstan", invested_amount=0):
    if profit <= 0:
        return 0.0

    preset = TAX_PRESETS.get(regime, TAX_PRESETS["none"])

    if holding_years >= preset["long_term_years"]:
        rate = preset["long_term_rate"]

        if preset["has_ldv"]:
            ldv_limit = preset["ldv_per_year"] * holding_years
            taxable = max(0, profit - ldv_limit)
            return taxable * rate
    else:
        rate = preset["short_term_rate"]

    return profit * rate


def apply_tax_to_returns(total_return, holding_years, regime="kazakhstan"):
    if total_return <= 0:
        return total_return

    tax_rate = get_effective_rate(holding_years, regime)
    return total_return * (1 - tax_rate)


def get_effective_rate(holding_years, regime="kazakhstan"):
    preset = TAX_PRESETS.get(regime, TAX_PRESETS["none"])

    if holding_years >= preset["long_term_years"]:
        return preset["long_term_rate"]
    else:
        return preset["short_term_rate"]


def tax_summary(profit, holding_years, regime="kazakhstan"):
    preset = TAX_PRESETS[regime]
    tax = calc_tax(profit, holding_years, regime)
    after_tax = profit - tax
    eff_rate = tax / profit if profit > 0 else 0

    return {
        "regime": preset["name"],
        "profit": profit,
        "tax": tax,
        "after_tax": after_tax,
        "effective_rate": f"{eff_rate:.1%}",
        "holding_years": holding_years,
    }