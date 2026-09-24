"""Exact rational arithmetic. Convert to JSON numbers only at the API boundary."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from fractions import Fraction
from itertools import combinations
from math import comb

from app.models.schemas import Decision
from app.simulation.catalog import Catalog
from app.simulation.validation import canonical_decisions


@dataclass(frozen=True)
class AppliedSynergy:
    measure_ids: tuple[str, str]
    district_id: str
    effects: Mapping[str, Fraction]


@dataclass(frozen=True)
class Calculation:
    indicators: dict[str, dict[str, Fraction]]
    district_scores: dict[str, Fraction]
    city_average: Fraction
    weakest_id: str
    critical: tuple[tuple[str, str], ...]
    score: Fraction
    synergies: tuple[AppliedSynergy, ...]


def evaluate_indicators(
    indicators: dict[str, dict[str, Fraction]], catalog: Catalog, synergies: tuple[AppliedSynergy, ...] = ()
) -> Calculation:
    scores = {
        district_id: sum((catalog.weights[k] * v for k, v in values.items()), Fraction())
        for district_id, values in indicators.items()
    }
    average = sum((catalog.districts[d].population_share * score for d, score in scores.items()), Fraction())
    # Stable tie-break, independent of decision order.
    weakest = min(scores, key=lambda district_id: (scores[district_id], district_id))
    critical = tuple(
        (d, k)
        for d, values in indicators.items()
        for k, v in values.items()
        if v < catalog.critical_threshold
    )
    score = (
        catalog.city_weight * average
        + catalog.weakest_weight * scores[weakest]
        - catalog.critical_penalty * len(critical)
    )
    return Calculation(indicators, scores, average, weakest, critical, score, synergies)


def calculate(decisions: Sequence[Decision], catalog: Catalog) -> Calculation:
    """Internal evaluator for validated scenarios and Shapley subsets, not an API validator."""
    indicators = {d.id: dict(d.indicators) for d in catalog.districts.values()}
    selected = {d.measure_id: d for d in decisions}
    for decision in canonical_decisions(decisions):
        measure = catalog.measures[decision.measure_id]
        targets = tuple(catalog.districts) if measure.scope == "city" else (decision.district_id,)
        factor = Fraction(catalog.horizon - measure.lag, catalog.horizon)
        for target in targets:
            for indicator, effect in measure.effects.items():
                indicators[target][indicator] += effect * factor
    applied = []
    for rule in catalog.synergies:
        if all(m in selected for m in rule.measures):
            target = selected[rule.district_from].district_id
            for indicator, effect in rule.effects.items():
                indicators[target][indicator] += effect
            applied.append(AppliedSynergy(rule.measures, target, rule.effects))
    # Clamp once AFTER adding all effects and synergies.
    for values in indicators.values():
        for key, value in values.items():
            values[key] = max(Fraction(0), min(Fraction(100), value))
    return evaluate_indicators(indicators, catalog, tuple(applied))


def shapley_contributions(decisions: Sequence[Decision], catalog: Catalog) -> dict[Decision, Fraction]:
    """Average marginal contribution over all orders; shares synergy and critical thresholds.

    Partial subsets are mathematical counterfactuals, never official finalized scenarios.
    At most 32 score evaluations for five decisions. Exact contributions sum to score delta.
    """
    selected = canonical_decisions(decisions)
    n = len(selected)
    if not n:
        return {}
    scores = {
        mask: calculate([selected[i] for i in range(n) if mask & (1 << i)], catalog).score
        for mask in range(1 << n)
    }
    contributions = {}
    for i, decision in enumerate(selected):
        total = Fraction()
        others = [j for j in range(n) if j != i]
        for size in range(n):
            weight = Fraction(1, n * comb(n - 1, size))
            for subset in combinations(others, size):
                mask = sum(1 << j for j in subset)
                total += weight * (scores[mask | (1 << i)] - scores[mask])
        contributions[decision] = total
    return contributions
