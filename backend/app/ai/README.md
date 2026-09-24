# AI analyst, advice, and executive report

This package explains and summarizes results calculated by the deterministic simulation engine. It does not calculate scores, budgets, indicator changes, or policy validity.

## Production integration

The production app mounts the simulation-owned adapters from `app.main`: `app.api.simulation.ai_bridge` for analysis and reports, and `app.api.simulation.advice` for City Council suggestions. These adapters are responsible for validating/recalculating decisions and building AI inputs from trusted catalog and engine data.

The public routes in `shared/api-contract.md` are:

- `POST /api/ai/analyze`: frontend scenario request; backend extracts decision IDs, recalculates the scenario, and returns structured findings with evidence.
- `POST /api/ai/compare`: two decision arrays, independently recalculated on the backend; returns analysis plus trusted scenario IDs and dataset version.
- `POST /api/explain`: decisions and an optional question; backend recalculates and returns a concise analysis.
- `POST /api/ai/advice`: decisions for a partial plan and optional question; backend prepares trusted current-state/candidate data and returns individually validated addition suggestions.
- `POST /api/report/executive-brief`: decisions and an optional question; backend calculates the snapshot, runs analysis, and returns `ExecutiveBrief` fields plus Markdown.

Do not mount `create_ai_router()` or `create_report_router()` alongside the production adapters. The standalone routers accept internal AI models directly; mounting them creates duplicate routes and can bypass the backend's source-of-truth recalculation.

## City Council advice

`advise_scenario()` accepts an internal `AdviceRequest` and returns up to three measure/district suggestions. It checks that suggested IDs exist in the candidate set supplied to it, are not already selected, and match city/district scope.

The simulation-owned advice adapter constructs that request from the trusted catalog and current engine state, then validates every suggested addition with the deterministic backend validator. Suggestions are individual alternatives; their combined validity is not promised. The frontend must send a selected suggestion back through simulation validation before applying it. Advice never changes a plan by itself.

## Data and model boundaries

`ScenarioSnapshot` contains engine-computed scores, budget totals, decisions, district before/after values, optional category/indicator facts, critical-indicator counts, and synergies. Prompts treat user text and JSON values as untrusted input. The model may explain supplied facts and suggest next steps, but must not invent or recompute numerical outcomes.

The executive brief is a structured JSON response with a Markdown body for preview/export. This package does not generate PDF or DOCX files. Numeric values in the report are copied from the backend snapshot.

## Provider configuration

The OpenAI provider reads `backend/.env` when configured; process environment variables take precedence. Keep the API key only in local `backend/.env`, which must remain untracked. Never place keys in source code, `.env.example`, fixtures, or commit history.

`OPENAI_MODEL` is optional and defaults to `gpt-6-astra`. Install AI dependencies from the backend directory with `python -m pip install -r requirements-ai.txt`.

## Examples and checks

- `examples/analysis_request.json` and `examples/analysis_response.json` show the internal analysis contract.
- `examples/advice_request.json` shows the internal advice/candidate contract; it is not the public HTTP request.
- Fixtures are synthetic and illustrative; production values must come from the simulation engine.
- From `backend/`, run `python scripts/check_ai_contract.py` and `python -m pytest` after the AI package and backend adapter are in the same checkout.
