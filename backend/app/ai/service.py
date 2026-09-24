"""Orchestration for AI analysis and advice; simulation stays deterministic."""
from collections.abc import Callable
from typing import Any

from .prompts import ADVICE_PROMPT, SYSTEM_PROMPT
from .schemas import (
    AdviceRequest,
    AdviceResponse,
    AnalysisRequest,
    AnalysisResponse,
)


JsonGenerator = Callable[[str, dict[str, Any]], dict[str, Any]]


class AdviceValidationError(ValueError):
    """The model returned a suggestion outside the supplied candidate set."""


def build_analysis_payload(request: AnalysisRequest) -> dict[str, Any]:
    """Build the data-only payload passed to a model provider."""
    return {
        "scenario": request.scenario.model_dump(),
        "question": request.question,
    }


def analyze_scenario(
    request: AnalysisRequest,
    generate_json: JsonGenerator,
) -> AnalysisResponse:
    """Ask an injected provider for schema-shaped analysis and validate it."""
    raw = generate_json(SYSTEM_PROMPT, build_analysis_payload(request))
    return AnalysisResponse.model_validate(raw)


def build_advice_payload(request: AdviceRequest) -> dict[str, Any]:
    """Build an advisory payload from current engine facts and candidates."""
    return request.model_dump()


def advise_scenario(
    request: AdviceRequest,
    generate_json: JsonGenerator,
) -> AdviceResponse:
    """Return advice restricted to the exact measures and districts provided."""
    raw = generate_json(ADVICE_PROMPT, build_advice_payload(request))
    advice = AdviceResponse.model_validate(raw)

    selected_ids = {decision.measure_id for decision in request.selected_decisions}
    measures = {measure.measure_id: measure for measure in request.available_measures}
    district_ids = {district.district_id for district in request.districts}
    seen_ids: set[str] = set()

    for suggestion in advice.suggestions:
        measure = measures.get(suggestion.measure_id)
        if measure is None:
            raise AdviceValidationError("AI предложил меру вне доступного каталога.")
        if suggestion.measure_id in selected_ids:
            raise AdviceValidationError("AI повторно предложил уже выбранную меру.")
        if suggestion.measure_id in seen_ids:
            raise AdviceValidationError("AI повторно предложил одну и ту же меру.")
        seen_ids.add(suggestion.measure_id)

        if measure.scope == "city" and suggestion.district_id is not None:
            raise AdviceValidationError("Для городской меры район указывать нельзя.")
        if measure.scope == "district":
            if suggestion.district_id is None:
                raise AdviceValidationError("Для районной меры нужно указать район.")
            if suggestion.district_id not in district_ids:
                raise AdviceValidationError("AI указал район вне текущего набора данных.")

    return advice

