"""Standalone routes for isolated AI-module use.

The production app mounts simulation-owned adapters so client-supplied facts
are recalculated and validated before reaching these services.
"""
from fastapi import APIRouter, HTTPException

from .openai_provider import (
    AIProviderError,
    create_openai_advice_generator,
    create_openai_json_generator,
)
from .schemas import (
    AdviceRequest,
    AdviceResponse,
    AnalysisRequest,
    AnalysisResponse,
)
from .service import (
    AdviceValidationError,
    JsonGenerator,
    advise_scenario,
    analyze_scenario,
)


def create_ai_router(
    generate_json: JsonGenerator | None = None,
    generate_advice_json: JsonGenerator | None = None,
) -> APIRouter:
    """Create standalone AI routes for isolated checks, not production mounting."""
    analysis_provider = generate_json or create_openai_json_generator()
    advice_provider = generate_advice_json or create_openai_advice_generator()
    router = APIRouter()

    @router.post("/api/ai/analyze", response_model=AnalysisResponse)
    def analyze(request: AnalysisRequest) -> AnalysisResponse:
        try:
            return analyze_scenario(request, analysis_provider)
        except AIProviderError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @router.post("/api/ai/advice", response_model=AdviceResponse)
    def advice(request: AdviceRequest) -> AdviceResponse:
        try:
            return advise_scenario(request, advice_provider)
        except AIProviderError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except AdviceValidationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return router
