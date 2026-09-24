"""Build a shareable executive report from engine facts and AI findings."""
from ..ai.schemas import (
    AnalysisResponse,
    DistrictScoreChange,
    ExecutiveBrief,
    Finding,
    ScenarioSnapshot,
)


def _bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- Нет данных"


def _district_table(districts: list[DistrictScoreChange]) -> str:
    if not districts:
        return "_Данные по районам не предоставлены._"
    rows = [
        "| Район | До | После |",
        "|---|---:|---:|",
    ]
    rows.extend(
        f"| {district.district_name} | {district.before_score} | "
        f"{district.after_score} |"
        for district in districts
    )
    return "\n".join(rows)


def build_executive_brief(
    scenario: ScenarioSnapshot,
    analysis: AnalysisResponse,
) -> ExecutiveBrief:
    """Create structured fields and Markdown without recalculating any values."""
    district_facts = [
        Finding(
            text=(
                f"{district.district_name}: "
                f"{district.before_score} → {district.after_score}"
            ),
            evidence=[
                f"Расчётный показатель района {district.district_name}",
                f"До: {district.before_score}; после: {district.after_score}",
            ],
        )
        for district in scenario.districts
        if district.after_score > district.before_score
    ]
    improvements = analysis.strengths or district_facts
    budget = scenario.budget
    decision_lines = [
        f"{d.measure_id} — {d.name} ({d.category}, {d.cost}; "
        f"{d.district_name or 'весь город'})"
        for d in scenario.decisions
    ]
    markdown = "\n".join(
        [
            "# City Management Report",
            "",
            f"**Astana Quality of Life Score:** {scenario.score_before} → "
            f"{scenario.score_after} (изменение: {scenario.score_delta})",
            f"**Бюджет:** {budget.spent} из {budget.initial}; "
            f"остаток {budget.remaining}",
            "",
            "## Районы: до и после",
            _district_table(scenario.districts),
            "",
            "## Принятые решения",
            _bullet_list(decision_lines),
            "",
            "## Основные улучшения",
            _bullet_list([finding.text for finding in improvements]),
            "",
            "## Оставшиеся риски",
            _bullet_list([finding.text for finding in analysis.risks]),
            "",
            "## Компромиссы и равенство районов",
            _bullet_list([finding.text for finding in analysis.tradeoffs]),
            "",
            "## Сработавшие синергии",
            _bullet_list(scenario.synergies),
            "",
            "## Рекомендации",
            _bullet_list(analysis.recommendations),
        ]
    )
    return ExecutiveBrief(
        title="City Management Report",
        score_before=scenario.score_before,
        score_after=scenario.score_after,
        score_delta=scenario.score_delta,
        budget=budget,
        decisions=scenario.decisions,
        districts=scenario.districts,
        synergies=scenario.synergies,
        major_improvements=improvements,
        remaining_risks=analysis.risks,
        equity=analysis.tradeoffs,
        recommendations=analysis.recommendations,
        markdown=markdown,
    )
