"""FastAPI route for turning verified results into a shareable brief."""
from fastapi import APIRouter

from ..ai.schemas import (
    AnalysisResponse,
    ExecutiveBrief,
    ScenarioSnapshot,
    StrictModel,
)
from .executive_brief import build_executive_brief


class ExecutiveBriefRequest(StrictModel):
    scenario: ScenarioSnapshot
    analysis: AnalysisResponse


def create_report_router() -> APIRouter:
    router = APIRouter()

    @router.post(
        "/api/report/executive-brief",
        response_model=ExecutiveBrief,
    )
    def executive_brief(request: ExecutiveBriefRequest) -> ExecutiveBrief:
        return build_executive_brief(request.scenario, request.analysis)

    return router
