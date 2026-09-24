"""Validated contracts for AI analysis and advisory endpoints."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BudgetSummary(StrictModel):
    initial: float
    spent: float
    remaining: float


class DecisionSummary(StrictModel):
    measure_id: str
    name: str
    category: str
    scope: Literal["district", "city"]
    cost: float
    district_id: str | None = None
    district_name: str | None = None
    # Supplied by the simulation engine when contribution analysis is available.
    contribution: float | None = None


class DistrictScoreChange(StrictModel):
    district_id: str
    district_name: str
    before_score: float
    after_score: float
    # Indicator values are already calculated by the simulation engine.
    indicators_before: dict[str, float] = Field(default_factory=dict)
    indicators_after: dict[str, float] = Field(default_factory=dict)


class CategoryScoreChange(StrictModel):
    category: str
    before_score: float
    after_score: float


class ScenarioSnapshot(StrictModel):
    """Facts computed by the simulation engine and safe to explain."""

    score_before: float
    score_after: float
    score_delta: float
    budget: BudgetSummary
    decisions: list[DecisionSummary]
    districts: list[DistrictScoreChange]
    category_scores: list[CategoryScoreChange] = Field(default_factory=list)
    critical_indicators_before: int | None = None
    critical_indicators_after: int | None = None
    synergies: list[str] = Field(default_factory=list)


class AnalysisRequest(StrictModel):
    scenario: ScenarioSnapshot
    question: str | None = Field(default=None, max_length=1000)


class Finding(StrictModel):
    text: str
    evidence: list[str]


class AnalysisResponse(StrictModel):
    strengths: list[Finding]
    risks: list[Finding]
    tradeoffs: list[Finding]
    recommendations: list[str]
    # Required-but-nullable so the model always returns the structured key.
    answer: str | None = Field(...)


class AdviceDistrict(StrictModel):
    district_id: str
    district_name: str
    indicators: dict[str, float]


class AvailableMeasure(StrictModel):
    measure_id: str
    name: str
    category: str
    scope: Literal["district", "city"]
    cost: float
    lag_quarters: int
    # Full organizer effects, before lag. The AI must not recompute outcomes.
    effects: dict[str, float]


class AdviceRequest(StrictModel):
    selected_decisions: list[DecisionSummary]
    budget_remaining: float
    districts: list[AdviceDistrict]
    available_measures: list[AvailableMeasure]
    question: str | None = Field(default=None, max_length=1000)


class AdviceSuggestion(StrictModel):
    measure_id: str
    # Required-but-nullable: district measures name a district; city measures use null.
    district_id: str | None = Field(...)


class AdviceResponse(StrictModel):
    priority: str
    reason: str
    suggestions: list[AdviceSuggestion] = Field(default_factory=list, max_length=3)


class ExecutiveBrief(StrictModel):
    title: str
    score_before: float
    score_after: float
    score_delta: float
    budget: BudgetSummary
    decisions: list[DecisionSummary]
    districts: list[DistrictScoreChange]
    synergies: list[str]
    major_improvements: list[Finding]
    remaining_risks: list[Finding]
    equity: list[Finding]
    recommendations: list[str]
    markdown: str

