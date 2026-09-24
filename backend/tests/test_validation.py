import pytest

from app.models.schemas import Decision
from app.simulation.service import simulate
from app.simulation.validation import validate


def d(measure, district=None):
    return Decision(measure_id=measure, district_id=district)


@pytest.mark.parametrize(
    "decisions,code",
    [
        ([d("M99")], "UNKNOWN_MEASURE"),
        ([d("M7", "other")], "UNKNOWN_DISTRICT"),
        ([d("M7")], "DISTRICT_REQUIRED"),
        ([d("M12", "nura")], "DISTRICT_NOT_ALLOWED"),
        ([d("M7", "nura"), d("M7", "esil")], "DUPLICATE_MEASURE"),
        ([d("M7", "nura"), d("M8", "esil"), d("M9", "saryarka")], "CATEGORY_LIMIT"),
        ([d("M1", "nura"), d("M3", "esil")], "INCOMPATIBLE_MEASURES"),
        ([d("M4", "nura"), d("M7", "nura")], "INCOMPATIBLE_MEASURES"),
        ([d("M5", "nura"), d("M13", "nura")], "INCOMPATIBLE_MEASURES"),
        (
            [d("M3", "nura"), d("M5", "saryarka"), d("M8", "nura"), d("M10", "nura"), d("M12")],
            "BUDGET_EXCEEDED",
        ),
        ([d("M12")] * 6, "DECISION_COUNT"),
    ],
)
def test_rules_reject_with_reason(catalog, decisions, code):
    issues = validate(decisions, catalog, finalize=False)
    assert code in {e.code for e in issues}
    assert all(e.message for e in issues)
    result = simulate(decisions, catalog)
    assert result.after is None and result.score_delta is None and result.score is None
    assert not result.finalized


@pytest.mark.parametrize("pair", [("M4", "M7"), ("M5", "M13")])
def test_local_conflict_permitted_in_different_districts(catalog, pair):
    assert not validate([d(pair[0], "nura"), d(pair[1], "esil")], catalog, finalize=False)


@pytest.mark.parametrize("count", [0, 1, 4, 6])
def test_finalize_exactly_five(catalog, example, count):
    selected = (example + [d("M2")])[:count]
    assert "DECISION_COUNT" in {e.code for e in validate(selected, catalog, finalize=True)}


def test_empty_preview_and_official_example(catalog, example):
    assert validate([], catalog, finalize=False) == []
    assert validate(example, catalog, finalize=True) == []


def test_budget_boundary_100(catalog):
    choices = [d("M3", "nura"), d("M6"), d("M7", "nura"), d("M10", "nura"), d("M12")]
    result = simulate(choices, catalog, finalize=True)
    assert result.validation.status == "valid"
    assert result.budget.spent == 100 and result.budget.remaining == 0


def test_cheapest_published_set_is_valid(catalog):
    choices = [d("M9", "nura"), d("M11", "nura"), d("M10", "nura"), d("M12"), d("M4", "saryarka")]
    result = simulate(choices, catalog, finalize=True)
    assert result.validation.status == "valid" and result.budget.spent == 61


def test_collects_multiple_errors(catalog):
    issues = validate([d("M3", "nura"), d("M1", "nura"), d("M1", "esil")], catalog, finalize=True)
    assert {e.code for e in issues} >= {
        "DECISION_COUNT",
        "DUPLICATE_MEASURE",
        "CATEGORY_LIMIT",
        "INCOMPATIBLE_MEASURES",
    }
