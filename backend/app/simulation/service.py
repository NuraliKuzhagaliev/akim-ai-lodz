import hashlib
import json
from collections.abc import Sequence
from fractions import Fraction

from app.models.schemas import (
    Budget,
    Contribution,
    CriticalIndicator,
    Decision,
    District,
    Measure,
    Simulation,
    Snapshot,
    Synergy,
    Validation,
)
from app.simulation.catalog import Catalog
from app.simulation.engine import Calculation, calculate, shapley_contributions
from app.simulation.validation import canonical_decisions, validate


def snapshot(calculation: Calculation, catalog: Catalog) -> Snapshot:
    return Snapshot(
        score=float(calculation.score),
        city_average=float(calculation.city_average),
        weakest_district_id=calculation.weakest_id,
        critical_count=len(calculation.critical),
        districts=[
            District(
                id=d.id,
                name=d.name,
                population_share=float(d.population_share),
                profile=d.profile,
                indicators={k: float(v) for k, v in calculation.indicators[d.id].items()},
                score=float(calculation.district_scores[d.id]),
            )
            for d in catalog.districts.values()
        ],
    )


def public_measures(catalog: Catalog) -> list[Measure]:
    result = []
    for measure in catalog.measures.values():
        notes = [
            f"{' + '.join(c.measures)}: {c.reason}" for c in catalog.conflicts if measure.id in c.measures
        ]
        for rule in catalog.synergies:
            if measure.id in rule.measures:
                effects = ", ".join(f"{key} +{float(value):g}" for key, value in rule.effects.items())
                notes.append(
                    f"Синергия {' + '.join(rule.measures)}: {effects} в районе {rule.district_from}, без масштабирования лагом."
                )
        result.append(
            Measure(
                id=measure.id,
                name=measure.name,
                category=measure.category,
                scope=measure.scope,
                cost=measure.cost,
                lag=measure.lag,
                effects={k: float(v) for k, v in measure.effects.items()},
                description=f"{'Во всех районах' if measure.scope == 'city' else 'В выбранном районе'}. "
                f"Эффект за {catalog.horizon} кварталов: ({catalog.horizon} − {measure.lag}) / {catalog.horizon} от полного.",
                notes=notes,
            )
        )
    return result


def simulate(decisions: Sequence[Decision], catalog: Catalog, *, finalize: bool = False) -> Simulation:
    ordered = canonical_decisions(decisions)
    issues = validate(ordered, catalog, finalize=finalize)
    baseline = calculate((), catalog)
    spent = sum(catalog.measures[d.measure_id].cost for d in ordered if d.measure_id in catalog.measures)
    result = Simulation(
        model_version=catalog.version,
        data_checksum=catalog.checksum,
        decisions=list(ordered),
        validation=Validation(status="invalid" if issues else "valid", errors=issues),
        budget=Budget(total=catalog.budget, spent=spent, remaining=catalog.budget - spent),
        before=snapshot(baseline, catalog),
        after=None,
        score_delta=None,
        synergies=[],
        contributions=[],
        notice=catalog.notice,
    )
    if issues:
        return result
    calculated = calculate(ordered, catalog)
    result.after = snapshot(calculated, catalog)
    result.score_delta = float(calculated.score - baseline.score)
    result.finalized = finalize
    result.score = float(calculated.score) if finalize else None
    result.notice = catalog.notice + (
        ". Итог допустимого сценария."
        if finalize
        else ". Предварительный расчёт; официальный результат доступен после финализации пяти решений."
    )
    payload = [d.model_dump(by_alias=True, exclude_none=True) for d in ordered]
    digest = hashlib.sha256(
        json.dumps([catalog.checksum, payload], sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    # Content ID, not a database key. AI always recalculates decisions.
    result.scenario_id = digest
    result.synergies = [
        Synergy(
            measure_ids=list(s.measure_ids),
            district_id=s.district_id,
            description=f"{' + '.join(s.measure_ids)}: "
            + ", ".join(f"{k} +{float(v):g}" for k, v in s.effects.items()),
        )
        for s in calculated.synergies
    ]
    if finalize:
        result.contributions = [
            Contribution(measure_id=d.measure_id, district_id=d.district_id, score_impact=float(value))
            for d, value in shapley_contributions(ordered, catalog).items()
        ]
    result.critical_indicators = [
        CriticalIndicator(
            district_id=d,
            indicator_id=k,
            before=float(baseline.indicators[d][k]),
            after=float(calculated.indicators[d][k]),
            resolved=(d, k) not in calculated.critical,
        )
        for d, k in sorted(set(baseline.critical) | set(calculated.critical))
    ]
    return result


def ai_snapshot(result: Simulation, catalog: Catalog) -> dict:
    """Map verified numbers to feature/ai ScenarioSnapshot without changing its schema."""
    if not result.finalized or result.after is None or result.validation.status != "valid":
        raise ValueError("AI analysis requires a valid finalized scenario")
    contributions = {c.measure_id: c.score_impact for c in result.contributions}
    before = {d.id: d for d in result.before.districts}
    after = {d.id: d for d in result.after.districts}
    # Category radar values are normalized weighted indicator averages across population.
    categories = []
    for category in ("transport", "ecology", "social", "safety", "services"):
        keys = [k for k, c in catalog.indicator_categories.items() if c == category]
        category_weight = sum(catalog.weights[k] for k in keys)

        def average(districts: dict, keys=keys, category_weight=category_weight) -> float:
            return float(
                sum(
                    catalog.districts[d].population_share
                    * sum(catalog.weights[k] * Fraction(str(districts[d].indicators[k])) for k in keys)
                    / category_weight
                    for d in districts
                )
            )

        categories.append(
            {"category": category, "before_score": average(before), "after_score": average(after)}
        )
    return {
        "score_before": result.before.score,
        "score_after": result.after.score,
        "score_delta": result.score_delta,
        "budget": {
            "initial": result.budget.total,
            "spent": result.budget.spent,
            "remaining": result.budget.remaining,
        },
        "decisions": [
            {
                "measure_id": d.measure_id,
                "district_id": d.district_id,
                "district_name": catalog.districts[d.district_id].name if d.district_id else None,
                "name": catalog.measures[d.measure_id].name,
                "category": catalog.measures[d.measure_id].category,
                "scope": catalog.measures[d.measure_id].scope,
                "cost": catalog.measures[d.measure_id].cost,
                "contribution": contributions[d.measure_id],
            }
            for d in result.decisions
        ],
        "districts": [
            {
                "district_id": d,
                "district_name": after[d].name,
                "before_score": before[d].score,
                "after_score": after[d].score,
                "indicators_before": before[d].indicators,
                "indicators_after": after[d].indicators,
            }
            for d in catalog.districts
        ],
        "category_scores": categories,
        "critical_indicators_before": result.before.critical_count,
        "critical_indicators_after": result.after.critical_count,
        "synergies": [s.description for s in result.synergies],
    }
