from collections import Counter
from collections.abc import Sequence

from app.models.schemas import Decision, Issue
from app.simulation.catalog import Catalog


def canonical_decisions(decisions: Sequence[Decision]) -> tuple[Decision, ...]:
    return tuple(sorted(decisions, key=lambda d: (d.measure_id, d.district_id or "")))


def validate(decisions: Sequence[Decision], catalog: Catalog, *, finalize: bool) -> list[Issue]:
    issues: list[Issue] = []

    def add(code: str, message: str, ids: list[str] | None = None) -> None:
        issues.append(Issue(code=code, message=message, measure_ids=ids or []))

    if (finalize and len(decisions) != catalog.decision_count) or len(decisions) > catalog.decision_count:
        add(
            "DECISION_COUNT",
            f"Нужно {'ровно' if finalize else 'не более'} {catalog.decision_count} решений; получено {len(decisions)}.",
        )
    counts = Counter(d.measure_id for d in decisions)
    for measure_id, count in sorted(counts.items()):
        if count > 1:
            add(
                "DUPLICATE_MEASURE",
                f"Мера {measure_id} выбрана повторно. Каждая мера разрешена один раз.",
                [measure_id],
            )
    categories: Counter[str] = Counter()
    spent = 0
    selected: dict[str, list[Decision]] = {}
    for decision in canonical_decisions(decisions):
        measure = catalog.measures.get(decision.measure_id)
        if measure is None:
            add("UNKNOWN_MEASURE", f"Неизвестная мера: {decision.measure_id}.", [decision.measure_id])
            continue
        spent += measure.cost
        categories[measure.category] += 1
        selected.setdefault(measure.id, []).append(decision)
        if measure.scope == "district" and decision.district_id is None:
            add("DISTRICT_REQUIRED", f"Для меры {measure.id} выберите район.", [measure.id])
        if decision.district_id is not None and decision.district_id not in catalog.districts:
            add("UNKNOWN_DISTRICT", f"Неизвестный район: {decision.district_id}.", [measure.id])
        if measure.scope == "city" and decision.district_id is not None:
            add(
                "DISTRICT_NOT_ALLOWED",
                f"Мера {measure.id} действует на весь город; район указывать нельзя.",
                [measure.id],
            )
    if spent > catalog.budget:
        add(
            "BUDGET_EXCEEDED",
            f"Стоимость {spent} превышает бюджет {catalog.budget} на {spent - catalog.budget}.",
        )
    for category, count in sorted(categories.items()):
        if count > catalog.max_per_category:
            add(
                "CATEGORY_LIMIT",
                f"В направлении {category} выбрано {count} мер; максимум {catalog.max_per_category}.",
                sorted(
                    {
                        d.measure_id
                        for d in decisions
                        if d.measure_id in catalog.measures
                        and catalog.measures[d.measure_id].category == category
                    }
                ),
            )
    for rule in catalog.conflicts:
        left, right = rule.measures
        if left not in selected or right not in selected:
            continue
        same_district = any(
            a.district_id is not None and a.district_id == b.district_id
            for a in selected[left]
            for b in selected[right]
        )
        if rule.scope == "global" or same_district:
            add("INCOMPATIBLE_MEASURES", f"{left} + {right}: {rule.reason}", list(rule.measures))
    return issues
