"""Recompute advice inputs and validate each proposed addition with the engine."""

import importlib
import logging
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.api.simulation.routes import invalid_response
from app.models.schemas import AdviceResponse, Decision, ErrorResponse, ExplainRequest, Issue
from app.simulation.catalog import Catalog
from app.simulation.service import simulate
from app.simulation.validation import validate

logger = logging.getLogger(__name__)
Generator = Callable[[str, dict[str, Any]], dict[str, Any]]


def create_advice_router(catalog: Catalog, generator: Generator | None) -> APIRouter:
    router = APIRouter(tags=["AI integration"])

    @router.post(
        "/api/ai/advice",
        response_model=AdviceResponse,
        responses={
            422: {"model": ErrorResponse},
            502: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def advice(request: ExplainRequest):
        result = simulate(request.decisions, catalog)
        if result.validation.status == "invalid":
            return invalid_response(result.validation.errors)
        if len(result.decisions) >= catalog.decision_count:
            return invalid_response(
                [
                    Issue(
                        code="DECISION_COUNT",
                        message="Совет по добавлению меры доступен, пока выбрано меньше пяти решений.",
                    )
                ]
            )
        candidates = []
        for measure in catalog.measures.values():
            targets = [None] if measure.scope == "city" else list(catalog.districts)
            if any(
                not validate(
                    [*result.decisions, Decision(measure_id=measure.id, district_id=target)],
                    catalog,
                    finalize=False,
                )
                for target in targets
            ):
                candidates.append(
                    {
                        "measure_id": measure.id,
                        "name": measure.name,
                        "category": measure.category,
                        "scope": measure.scope,
                        "cost": measure.cost,
                        "lag_quarters": measure.lag,
                        "effects": {key: float(value) for key, value in measure.effects.items()},
                    }
                )
        if not candidates:
            return invalid_response(
                [
                    Issue(
                        code="NO_FEASIBLE_ADVICE",
                        message="Для текущего набора нет допустимого добавления. Измените выбранные меры.",
                    )
                ]
            )
        if generator is None:
            return JSONResponse(
                status_code=503,
                content=ErrorResponse(
                    code="AI_UNAVAILABLE",
                    message="AI-совет временно недоступен. Выбранные решения сохранены.",
                ).model_dump(by_alias=True),
            )
        try:
            schemas = importlib.import_module("app.ai.schemas")
            service = importlib.import_module("app.ai.service")
            facts = schemas.AdviceRequest(
                selected_decisions=[
                    {
                        "measure_id": d.measure_id,
                        "district_id": d.district_id,
                        "district_name": catalog.districts[d.district_id].name if d.district_id else None,
                        "name": catalog.measures[d.measure_id].name,
                        "category": catalog.measures[d.measure_id].category,
                        "scope": catalog.measures[d.measure_id].scope,
                        "cost": catalog.measures[d.measure_id].cost,
                    }
                    for d in result.decisions
                ],
                budget_remaining=result.budget.remaining,
                districts=[
                    {"district_id": d.id, "district_name": d.name, "indicators": d.indicators}
                    for d in result.after.districts
                ],
                available_measures=candidates,
                question=request.question,
            )
            response = service.advise_scenario(facts, generator)
            # Suggestions are alternatives, not a batch. Revalidate against fresh state on application.
            for suggestion in response.suggestions:
                issues = validate(
                    [
                        *result.decisions,
                        Decision(measure_id=suggestion.measure_id, district_id=suggestion.district_id),
                    ],
                    catalog,
                    finalize=False,
                )
                if issues:
                    return JSONResponse(
                        status_code=502,
                        content=ErrorResponse(
                            code="AI_INVALID_ADVICE",
                            message="AI предложил недопустимое добавление. Сценарий не изменён.",
                            errors=issues,
                        ).model_dump(by_alias=True),
                    )
            return {
                **response.model_dump(),
                "validation_mode": "individual_additions",
                "base_scenario_id": result.scenario_id,
            }
        except Exception as exc:
            logger.warning("AI advice failed (%s)", type(exc).__name__)
            return JSONResponse(
                status_code=503,
                content=ErrorResponse(
                    code="AI_UNAVAILABLE",
                    message="AI-совет временно недоступен. Выбранные решения сохранены.",
                ).model_dump(by_alias=True),
            )

    return router
