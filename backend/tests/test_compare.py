import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.simulation.service import simulate


def reply():
    return {"strengths": [], "risks": [], "tradeoffs": [], "recommendations": [], "answer": "Сравнение."}


def test_compare_recomputes_both_plans(catalog, example):
    original = simulate(example, catalog, finalize=True)
    alternative = [d.model_dump(by_alias=True) for d in example]
    alternative[-1] = {"measureId": "M3", "districtId": "nura"}
    calls = []

    def generator(prompt, payload):
        calls.append(payload)
        return reply()

    with TestClient(create_app(catalog=catalog, ai_generator=generator)) as client:
        response = client.post(
            "/api/ai/compare",
            json={
                "originalDecisions": [d.model_dump(by_alias=True) for d in example],
                "alternativeDecisions": alternative,
            },
        )
    assert response.status_code == 200
    assert response.json()["originalScenarioId"] == original.scenario_id
    assert response.json()["alternativeScenarioId"] != original.scenario_id
    assert response.json()["dataChecksum"] == catalog.checksum
    assert calls[0]["original"]["score_after"] == 56.54307
    assert calls[0]["alternative"]["score_after"] == 57.20556
    assert calls[0]["differences"]["district_scores"]["saryarka"] < 0
    assert calls[0]["differences"]["budget_spent"] == 5
    assert calls[0]["differences"]["score"] == 0.66249


@pytest.mark.parametrize("side", ["originalDecisions", "alternativeDecisions"])
def test_compare_invalid_plan_never_calls_provider(example, side):
    data = [d.model_dump(by_alias=True) for d in example]
    payload = {"originalDecisions": data, "alternativeDecisions": data, side: []}
    with TestClient(create_app(ai_generator=lambda *_: pytest.fail("Provider must not be called"))) as client:
        assert client.post("/api/ai/compare", json=payload).status_code == 422


def test_compare_identical_and_failure(example):
    data = [d.model_dump(by_alias=True) for d in example]
    payload = {"originalDecisions": data, "alternativeDecisions": data}

    def identical(_, facts):
        assert facts["differences"]["score"] == 0
        assert all(delta == 0 for delta in facts["differences"]["district_scores"].values())
        return reply()

    with TestClient(create_app(ai_generator=identical)) as client:
        result = client.post("/api/ai/compare", json=payload).json()
        assert result["originalScenarioId"] == result["alternativeScenarioId"]
        assert client.post("/api/ai/compare", json={**payload, "score": 999}).status_code == 422
    for generator in (None, lambda *_: {"bad": "schema"}):
        with TestClient(create_app(ai_generator=generator)) as client:
            assert client.post("/api/ai/compare", json=payload).status_code == 503
