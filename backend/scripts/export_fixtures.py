"""Generate committed fixtures from the only simulation engine (run from any cwd)."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import create_app  # noqa: E402
from app.models.schemas import ScenarioRequest  # noqa: E402
from app.simulation.catalog import load_catalog  # noqa: E402
from app.simulation.recommend import recommend  # noqa: E402
from app.simulation.service import ai_snapshot, public_measures, simulate  # noqa: E402


def main():
    catalog = load_catalog()
    request = ScenarioRequest.model_validate(
        json.loads((ROOT / "shared/example-scenario.json").read_text(encoding="utf-8"))
    )
    result = simulate(request.decisions, catalog, finalize=True)
    fixtures = ROOT / "shared/fixtures"
    fixtures.mkdir(exist_ok=True)
    values = {
        "districts.json": [d.model_dump(by_alias=True) for d in result.before.districts],
        "measures.json": [m.model_dump(by_alias=True) for m in public_measures(catalog)],
        "preview.json": simulate([], catalog).model_dump(by_alias=True),
        "official-result.json": result.model_dump(by_alias=True),
        "ai-snapshot.json": ai_snapshot(result, catalog),
        "recommendation.json": recommend(request.decisions, catalog).model_dump(by_alias=True),
        "invalid-result.json": simulate([], catalog, finalize=True).model_dump(by_alias=True),
    }
    for name, value in values.items():
        (fixtures / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "shared/openapi.json").write_text(
        json.dumps(create_app().openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Exported {len(values)} fixtures and OpenAPI.")


if __name__ == "__main__":
    main()
