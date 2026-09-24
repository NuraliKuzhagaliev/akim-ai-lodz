from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schemas import District, ErrorResponse, Measure, Recommendation, ScenarioRequest, Simulation
from app.simulation.catalog import Catalog
from app.simulation.engine import calculate
from app.simulation.recommend import recommend
from app.simulation.service import public_measures, simulate, snapshot
from app.simulation.validation import validate


def invalid_response(errors):
    body = ErrorResponse(
        message="Сценарий недопустим. Исправьте указанные ошибки.", code="INVALID_SCENARIO", errors=errors
    )
    return JSONResponse(status_code=422, content=body.model_dump(by_alias=True))


def create_router(catalog: Catalog) -> APIRouter:
    router = APIRouter(tags=["Simulation"])

    @router.get("/api/districts", response_model=list[District])
    def districts():
        return snapshot(calculate((), catalog), catalog).districts

    @router.get("/api/measures", response_model=list[Measure])
    def measures():
        return public_measures(catalog)

    @router.get("/api/bootstrap")
    def bootstrap():
        return {
            "modelVersion": catalog.version,
            "dataChecksum": catalog.checksum,
            "notice": catalog.notice,
            "districts": [d.model_dump(by_alias=True) for d in districts()],
            "measures": [m.model_dump(by_alias=True) for m in measures()],
            "before": snapshot(calculate((), catalog), catalog).model_dump(by_alias=True),
            "rules": {
                "budget": catalog.budget,
                "decisionCount": catalog.decision_count,
                "maxPerCategory": catalog.max_per_category,
                "horizonQuarters": catalog.horizon,
                "criticalThreshold": float(catalog.critical_threshold),
            },
        }

    @router.post("/api/simulate", response_model=Simulation)
    def preview(request: ScenarioRequest):
        return simulate(request.decisions, catalog)

    @router.post("/api/scenario/finalize", response_model=Simulation)
    def finalize(request: ScenarioRequest):
        # Domain-invalid scenarios use the same typed envelope as preview.
        return simulate(request.decisions, catalog, finalize=True)

    @router.post("/api/recommend", response_model=Recommendation, responses={422: {"model": ErrorResponse}})
    def recommend_one(request: ScenarioRequest):
        errors = validate(request.decisions, catalog, finalize=True)
        return invalid_response(errors) if errors else recommend(request.decisions, catalog)

    return router
