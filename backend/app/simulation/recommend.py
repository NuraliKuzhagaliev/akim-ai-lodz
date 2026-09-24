from collections.abc import Sequence
from itertools import chain

from app.models.schemas import Decision, Recommendation
from app.simulation.catalog import Catalog
from app.simulation.engine import calculate
from app.simulation.service import simulate
from app.simulation.validation import canonical_decisions, validate


def candidates(decisions: Sequence[Decision], catalog: Catalog):
    """Every one-measure replacement, including relocating the same measure."""
    original = canonical_decisions(decisions)
    all_choices = tuple(
        chain.from_iterable(
            [Decision(measure_id=m.id)]
            if m.scope == "city"
            else [Decision(measure_id=m.id, district_id=d) for d in catalog.districts]
            for m in catalog.measures.values()
        )
    )
    seen = {original}
    for index in range(len(original)):
        for replacement in all_choices:
            candidate = canonical_decisions((*original[:index], replacement, *original[index + 1 :]))
            if candidate not in seen:
                seen.add(candidate)
                yield candidate


def recommend(decisions: Sequence[Decision], catalog: Catalog) -> Recommendation:
    errors = validate(decisions, catalog, finalize=True)
    if errors:
        raise ValueError("Recommendation requires a valid five-decision scenario")
    current = calculate(decisions, catalog)
    current_cost = sum(catalog.measures[d.measure_id].cost for d in decisions)
    best = None
    checked = valid = 0
    for candidate in candidates(decisions, catalog):
        checked += 1
        if validate(candidate, catalog, finalize=True):
            continue
        valid += 1
        result = calculate(candidate, catalog)
        if result.score <= current.score:
            continue
        cost = sum(catalog.measures[d.measure_id].cost for d in candidate)
        key = (-result.score, cost, tuple((d.measure_id, d.district_id or "") for d in candidate))
        if best is None or key < best[0]:
            best = (key, candidate, result, cost)
    if best is None:
        return Recommendation(
            found=False,
            explanation="Среди всех допустимых замен одной меры или её района улучшения Score не найдено.",
            candidates_checked=checked,
            valid_candidates=valid,
        )
    _, selected, result, cost = best
    return Recommendation(
        found=True,
        explanation="Лучший найденный вариант с одной заменой. Проверены бюджет, направления и несовместимости. Это не поиск глобального оптимума.",
        decisions=list(selected),
        result=simulate(selected, catalog, finalize=True),
        candidates_checked=checked,
        valid_candidates=valid,
        cost_delta=cost - current_cost,
        score_delta=float(result.score - current.score),
        weakest_score_delta=float(
            result.district_scores[result.weakest_id] - current.district_scores[current.weakest_id]
        ),
    )
