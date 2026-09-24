from dataclasses import replace
from fractions import Fraction as F
from itertools import permutations
from types import MappingProxyType

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.models.schemas import Decision
from app.simulation.catalog import load_catalog
from app.simulation.engine import calculate, evaluate_indicators, shapley_contributions
from app.simulation.service import simulate


def d(measure, district=None):
    return Decision(measure_id=measure, district_id=district)


def test_exact_official_baseline(catalog):
    result = calculate([], catalog)
    assert result.score == F("52.55768")
    assert result.city_average == F("56.8624")
    assert result.district_scores == {
        "esil": F("62.99"),
        "almaty": F("57.06"),
        "saryarka": F("54.65"),
        "baikonur": F("56.63"),
        "nura": F("49.18"),
    }
    assert result.critical == (("nura", "S1"), ("nura", "S2"))


def test_exact_official_example(catalog, example):
    result = calculate(example, catalog)
    assert result.score == F("56.54307")
    assert sum(catalog.measures[item.measure_id].cost for item in example) == 95
    assert result.indicators["nura"]["S1"] == 48
    assert result.indicators["nura"]["S2"] == F("43.75")
    assert result.indicators["nura"]["B1"] == F("67.5")
    assert not result.critical


@pytest.mark.parametrize(
    "measure,target,expected",
    [
        ("M1", "nura", {"T1": "59.5", "T2": "46.75"}),
        ("M3", "nura", {"T1": "63", "T2": "50", "E2": "67"}),
        ("M5", "saryarka", {"E2": "48.75", "C1": "47.5"}),
        ("M11", "nura", {"B2": "60.5", "T1": "53.25"}),
        ("M13", "almaty", {"C1": "59", "E2": "56"}),
    ],
)
def test_lags_and_negative_effects(catalog, measure, target, expected):
    result = calculate([d(measure, target)], catalog)
    for key, value in expected.items():
        assert result.indicators[target][key] == F(value)
    for other in catalog.districts:
        if other != target:
            assert result.indicators[other] == catalog.districts[other].indicators


def test_city_effect_applies_to_all_districts(catalog):
    result = calculate([d("M12")], catalog)
    for id_, district in catalog.districts.items():
        assert result.indicators[id_]["C2"] == district.indicators["C2"] + F("4.375")


@pytest.mark.parametrize(
    "first,second,key,bonus", [("M1", "M2", "T1", 2), ("M10", "M12", "B1", 2), ("M5", "M6", "E2", 2)]
)
def test_each_synergy_fixed_and_local(catalog, first, second, key, bonus):
    pair = calculate([d(first, "nura"), d(second)], catalog)
    a = calculate([d(first, "nura")], catalog)
    b = calculate([d(second)], catalog)
    base = catalog.districts["nura"].indicators[key]
    assert (
        pair.indicators["nura"][key] == a.indicators["nura"][key] + b.indicators["nura"][key] - base + bonus
    )
    assert pair.indicators["esil"][key] == b.indicators["esil"][key]
    assert len(pair.synergies) == 1


def test_critical_threshold_is_strict(catalog):
    values = {d.id: {k: F(40) for k in d.indicators} for d in catalog.districts.values()}
    assert evaluate_indicators(values, catalog).critical == ()
    values["nura"]["S1"] = F("39.999999999")
    assert evaluate_indicators(values, catalog).critical == (("nura", "S1"),)


def test_clamp_only_after_all_effects(catalog):
    district = catalog.districts["nura"]
    modified = replace(district, indicators={**district.indicators, "T1": F(99), "B2": F(99)})
    altered = replace(catalog, districts=MappingProxyType({**catalog.districts, "nura": modified}))
    result = calculate([d("M1", "nura"), d("M11", "nura")], altered)
    assert result.indicators["nura"]["T1"] == 100  # 99 + 4.5 - 1.75, then clamp
    assert result.indicators["nura"]["B2"] == 100
    low = replace(district, indicators={**district.indicators, "T1": F(1)})
    altered = replace(catalog, districts={**catalog.districts, "nura": low})
    assert calculate([d("M11", "nura")], altered).indicators["nura"]["T1"] == 0


def test_every_permutation_identical(catalog, example):
    expected = calculate(example, catalog)
    for order in permutations(example):
        assert calculate(order, catalog) == expected


def test_shapley_conserves_delta_and_order(catalog, example):
    expected = shapley_contributions(example, catalog)
    assert sum(expected.values()) == calculate(example, catalog).score - calculate([], catalog).score
    assert shapley_contributions(list(reversed(example)), catalog) == expected
    assert shapley_contributions([], catalog) == {}


def test_source_data_cannot_be_mutated(catalog, example):
    before = calculate([], catalog)
    calculate(example, catalog)
    with pytest.raises(TypeError):
        catalog.districts["nura"].indicators["S1"] = 100
    assert calculate([], catalog) == before


def test_preview_is_not_official(catalog):
    result = simulate([d("M7", "nura")], catalog)
    assert result.after is not None
    assert result.score is None and not result.finalized
    assert result.contributions == []


@settings(max_examples=60, deadline=None)
@given(st.lists(st.integers(1, 14), unique=True, max_size=5))
def test_random_subsets_bounded_repeatable_and_conserved(ids):
    catalog = load_catalog()
    decisions = [d(f"M{i}", "nura" if catalog.measures[f"M{i}"].scope == "district" else None) for i in ids]
    result = calculate(decisions, catalog)
    assert all(0 <= value <= 100 for values in result.indicators.values() for value in values.values())
    assert calculate(list(reversed(decisions)), catalog) == result
    assert (
        sum(shapley_contributions(decisions, catalog).values()) == result.score - calculate([], catalog).score
    )
