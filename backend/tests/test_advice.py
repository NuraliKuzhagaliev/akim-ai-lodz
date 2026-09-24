import copy

import pytest
from fastapi.routing import iter_route_contexts
from fastapi.testclient import TestClient

from app.main import create_app


def reply(measure="M5", district="nura"):
    return {
        "priority": "Проверить экологию",
        "reason": "Совет по данным модели.",
        "suggestions": [{"measure_id": measure, "district_id": district}],
    }


def test_advice_builds_facts_and_validates_addition(catalog):
    calls = []

    def provider(_prompt, payload):
        calls.append(copy.deepcopy(payload))
        return reply()

    with TestClient(create_app(catalog=catalog, ai_advice_generator=provider)) as client:
        response = client.post(
            "/api/ai/advice", json={"decisions": [{"measureId": "M7", "districtId": "nura"}]}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["suggestions"] == reply()["suggestions"]
        assert data["validation_mode"] == "individual_additions"
        assert len(data["base_scenario_id"]) == 64
    payload = calls[0]
    assert payload["budget_remaining"] == 76
    assert payload["selected_decisions"][0]["cost"] == 24
    assert "M7" not in {m["measure_id"] for m in payload["available_measures"]}
    nura = next(d for d in payload["districts"] if d["district_id"] == "nura")
    assert nura["indicators"]["S1"] == 48


@pytest.mark.parametrize("extra", [{"budget_remaining": 999}, {"available_measures": []}, {"score": 999}])
def test_advice_rejects_client_facts(catalog, extra):
    def provider(*_args):
        pytest.fail("Forged metadata must never reach the provider")

    with TestClient(create_app(catalog=catalog, ai_advice_generator=provider)) as client:
        response = client.post("/api/ai/advice", json={"decisions": [], **extra})
        assert response.status_code == 422


def test_advice_rejects_incompatible_target_from_model(catalog):
    # M5 is legal in other districts, but not where M13 is already selected.
    with TestClient(create_app(catalog=catalog, ai_advice_generator=lambda *_: reply())) as client:
        response = client.post(
            "/api/ai/advice", json={"decisions": [{"measureId": "M13", "districtId": "nura"}]}
        )
        assert response.status_code == 502
        assert response.json()["code"] == "AI_INVALID_ADVICE"
        assert response.json()["errors"][0]["code"] == "INCOMPATIBLE_MEASURES"


def test_advice_filters_unaffordable_measures_before_call(catalog):
    def provider(_prompt, payload):
        assert payload["budget_remaining"] == 18
        assert all(m["cost"] <= 18 for m in payload["available_measures"])
        return reply("M12", None)

    decisions = [
        {"measureId": "M13", "districtId": "nura"},
        {"measureId": "M3", "districtId": "nura"},
        {"measureId": "M7", "districtId": "nura"},
    ]
    with TestClient(create_app(catalog=catalog, ai_advice_generator=provider)) as client:
        assert client.post("/api/ai/advice", json={"decisions": decisions}).status_code == 200


def test_advice_rejects_full_plan_without_provider(catalog, example):
    def provider(*_args):
        pytest.fail("Full plans require replacement, not addition advice")

    with TestClient(create_app(catalog=catalog, ai_advice_generator=provider)) as client:
        response = client.post(
            "/api/ai/advice", json={"decisions": [d.model_dump(by_alias=True) for d in example]}
        )
        assert response.status_code == 422


@pytest.mark.parametrize("suggestion", [reply("M999", "nura"), reply("M12", "nura"), reply("M5", "unknown")])
def test_advice_does_not_deliver_invalid_model_output(catalog, suggestion):
    with TestClient(create_app(catalog=catalog, ai_advice_generator=lambda *_: suggestion)) as client:
        response = client.post("/api/ai/advice", json={"decisions": []})
        assert response.status_code == 503
        assert "suggestions" not in response.json()


def test_advice_unconfigured_is_safe(catalog):
    with TestClient(create_app(catalog=catalog)) as client:
        response = client.post("/api/ai/advice", json={"decisions": []})
        assert response.status_code == 503


@pytest.mark.parametrize(
    "decisions, expected_code",
    [
        ([{"measureId": "M1"}, {"measureId": "M3", "districtId": "nura"}], "INVALID_SCENARIO"),
        (
            [
                {"measureId": "M13", "districtId": "nura"},
                {"measureId": "M3", "districtId": "nura"},
                {"measureId": "M7", "districtId": "nura"},
                {"measureId": "M12"},
            ],
            "INVALID_SCENARIO",
        ),
    ],
)
def test_advice_rejects_invalid_or_unextendable_plan_before_provider(catalog, decisions, expected_code):
    def provider(*_args):
        pytest.fail("No provider call when a legal addition is impossible")

    with TestClient(create_app(catalog=catalog, ai_advice_generator=provider)) as client:
        response = client.post("/api/ai/advice", json={"decisions": decisions})
        assert response.status_code == 422
        assert response.json()["code"] == expected_code


def test_integrated_routes_are_unique(catalog):
    app = create_app(catalog=catalog)
    paths = [route.path for route in iter_route_contexts(app.routes)]
    for path in ("/api/ai/analyze", "/api/ai/advice", "/api/report/executive-brief"):
        assert paths.count(path) == 1
