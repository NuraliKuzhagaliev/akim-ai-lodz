from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictStr
from pydantic.alias_generators import to_camel

Category = Literal["transport", "ecology", "social", "safety", "services"]
IndicatorId = Literal["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"]
DistrictId = Literal["esil", "almaty", "saryarka", "baikonur", "nura"]
Identifier = Annotated[StrictStr, Field(min_length=1, max_length=64)]


class WireModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        allow_inf_nan=False,
    )


class Decision(WireModel):
    model_config = ConfigDict(**{**WireModel.model_config, "frozen": True})
    measure_id: Identifier
    district_id: Identifier | None = Field(default=None, exclude_if=lambda v: v is None)


class ScenarioRequest(WireModel):
    decisions: list[Decision] = Field(max_length=100)


class District(WireModel):
    id: DistrictId
    name: str
    population_share: float
    profile: str
    indicators: dict[IndicatorId, float]
    score: float


class Measure(WireModel):
    id: str
    name: str
    category: Category
    scope: Literal["city", "district"]
    cost: int
    lag: int
    effects: dict[IndicatorId, float]
    description: str
    notes: list[str]


class Snapshot(WireModel):
    score: float
    city_average: float
    weakest_district_id: DistrictId
    critical_count: int
    districts: list[District]


class Issue(WireModel):
    code: str
    message: str
    measure_ids: list[str] = Field(default_factory=list)


class Validation(WireModel):
    status: Literal["valid", "invalid"]
    errors: list[Issue] = Field(default_factory=list)


class Budget(WireModel):
    total: int
    spent: int
    remaining: int


class Synergy(WireModel):
    measure_ids: list[str]
    district_id: DistrictId
    description: str


class Contribution(WireModel):
    measure_id: str
    district_id: DistrictId | None = Field(default=None, exclude_if=lambda v: v is None)
    score_impact: float


class CriticalIndicator(WireModel):
    district_id: DistrictId
    indicator_id: IndicatorId
    before: float
    after: float
    resolved: bool


class Simulation(WireModel):
    model_version: str
    data_checksum: str
    scenario_id: str | None = Field(default=None, exclude_if=lambda v: v is None)
    source: Literal["backend"] = "backend"
    decisions: list[Decision]
    validation: Validation
    budget: Budget
    before: Snapshot
    after: Snapshot | None
    score_delta: float | None
    synergies: list[Synergy]
    contributions: list[Contribution]
    notice: str
    # Additive fields: existing frontend Zod schema accepts these.
    finalized: bool = False
    score: float | None = None
    critical_indicators: list[CriticalIndicator] = Field(default_factory=list)
    contribution_method: Literal["shapley"] = "shapley"


class Recommendation(WireModel):
    found: bool
    explanation: str
    decisions: list[Decision] | None = Field(default=None, exclude_if=lambda v: v is None)
    result: Simulation | None = Field(default=None, exclude_if=lambda v: v is None)
    candidates_checked: int
    valid_candidates: int
    cost_delta: int | None = None
    score_delta: float | None = None
    weakest_score_delta: float | None = None


class SimulationInput(WireModel):
    model_config = ConfigDict(**{**WireModel.model_config, "extra": "ignore"})
    decisions: list[Decision] = Field(max_length=100)


class AnalyzeRequest(WireModel):
    # Accept the frontend's shape; only decisions are trusted as input.
    simulation: SimulationInput
    question: Annotated[StrictStr, Field(max_length=1000)] | None = None


class SummaryDecisionInput(Decision):
    # The AI owner's public input includes names/costs. Only IDs are authoritative input.
    model_config = ConfigDict(**{**Decision.model_config, "extra": "ignore"})


class ScenarioFactsInput(WireModel):
    model_config = ConfigDict(**{**WireModel.model_config, "extra": "ignore"})
    decisions: list[SummaryDecisionInput] = Field(max_length=100)


class ScenarioAnalyzeRequest(WireModel):
    scenario: ScenarioFactsInput
    question: Annotated[StrictStr, Field(max_length=1000)] | None = None


class FindingResponse(WireModel):
    text: str
    evidence: list[str]


class StructuredAnalysis(WireModel):
    strengths: list[FindingResponse]
    risks: list[FindingResponse]
    tradeoffs: list[FindingResponse]
    recommendations: list[str]
    answer: str | None


class ExplainRequest(ScenarioRequest):
    question: Annotated[StrictStr, Field(max_length=1000)] | None = None


class CompareRequest(WireModel):
    original_decisions: list[Decision] = Field(max_length=100)
    alternative_decisions: list[Decision] = Field(max_length=100)
    question: Annotated[StrictStr, Field(max_length=1000)] | None = None


class CompareResponse(WireModel):
    original_scenario_id: str
    alternative_scenario_id: str
    model_version: str
    data_checksum: str
    analysis: StructuredAnalysis


class AdviceSuggestionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    measure_id: Identifier
    district_id: DistrictId | None


class AdviceResponse(BaseModel):
    """Keep the AI participant's snake_case response, with explicit validation context."""

    model_config = ConfigDict(extra="forbid")
    priority: str
    reason: str
    suggestions: list[AdviceSuggestionResponse] = Field(max_length=3)
    validation_mode: Literal["individual_additions"] = "individual_additions"
    base_scenario_id: str


class Analysis(WireModel):
    source: Literal["ai"] = "ai"
    summary: str
    strengths: list[str]
    risks: list[str]
    tradeoffs: list[str]
    recommendations: list[str]


class ErrorResponse(WireModel):
    message: str
    code: str
    errors: list[Issue] = Field(default_factory=list)
    score: None = None
