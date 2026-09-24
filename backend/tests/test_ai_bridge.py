"""Runs with the actual AI participant's module after merge or AKIM_AI_REFERENCE."""

import copy
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.simulation.service import ai_snapshot, simulate

pytest.importorskip("app.ai.schemas", reason="AI-owned module is not merged; use AKIM_AI_REFERENCE")


@pytest.fixture
def provider_reply():
    return {
        "strengths": [
            {
                "text": "Улучшены показатели социальной инфраструктуры Нуры.",
                "evidence": ["districts.nura.indicators_after.S1"],
            }
        ],
        "risks": [{"text": "Сохраняются различия между районами.", "evidence": ["districts"]}],
        "tradeoffs": [],
        "recommendations": ["Сравнить проверенную замену одного решения."],
        "answer": "Анализ основан на предоставленных расчётных данных.",
    }


def test_actual_ai_schema_accepts_engine(catalog, example):
    from app.ai.schemas import ScenarioSnapshot

    facts = ai_snapshot(simulate(example, catalog, finalize=True), catalog)
    parsed = ScenarioSnapshot.model_validate(facts)
    assert parsed.score_after == 56.54307
    assert len(parsed.category_scores) == 5


@pytest.mark.parametrize("shape", ["scenario", "simulation", "decisions"])
def test_recomputes_tampered_frontend_facts(catalog, example, provider_reply, shape):
    calls = []

    def generator(_prompt, payload):
        calls.append(payload)
        return copy.deepcopy(provider_reply)

    final = simulate(example, catalog, finalize=True)
    if shape == "scenario":
        facts = ai_snapshot(final, catalog)
        facts["score_after"] = 999
        facts["budget"]["spent"] = 0
        facts["decisions"][0]["cost"] = 0
        facts["decisions"][0]["name"] = "FORGED"
        facts["districts"][0]["indicators_after"]["T1"] = 999
        payload = {"scenario": facts}
    elif shape == "simulation":
        final.after.score = 999
        payload = {"simulation": final.model_dump(by_alias=True)}
    else:
        payload = {"decisions": [d.model_dump(by_alias=True) for d in example]}
    endpoint = "/api/explain" if shape == "decisions" else "/api/ai/analyze"
    with TestClient(create_app(catalog=catalog, ai_generator=generator)) as client:
        result = client.post(endpoint, json=payload)
        assert result.status_code == 200, result.text
        output = result.json()
        if shape == "scenario":
            assert output == provider_reply
        else:
            assert output["source"] == "ai" and isinstance(output["strengths"][0], str)
    sent = calls[0]["scenario"]
    assert sent["score_after"] == 56.54307 and sent["budget"]["spent"] == 95
    assert all(d["cost"] > 0 and d["name"] != "FORGED" for d in sent["decisions"])
    assert sent["districts"][0]["indicators_after"]["T1"] == 45


def test_invalid_scenario_never_calls_provider(catalog):
    def generator(*_args):
        pytest.fail("Provider must not be called for invalid decisions")

    with TestClient(create_app(catalog=catalog, ai_generator=generator)) as client:
        response = client.post("/api/ai/analyze", json={"scenario": {"decisions": [], "score_after": 100}})
        assert response.status_code == 422


@pytest.mark.parametrize("failure", ["exception", "bad_schema"])
def test_provider_failures_are_safe(catalog, example, failure, caplog):
    def generator(*_args):
        if failure == "exception":
            raise RuntimeError("sensitive-provider-detail")
        return {"untrusted": "bad response"}

    with TestClient(create_app(catalog=catalog, ai_generator=generator)) as client:
        response = client.post(
            "/api/explain", json={"decisions": [d.model_dump(by_alias=True) for d in example]}
        )
        assert response.status_code == 503
        assert "sensitive-provider-detail" not in response.text + caplog.text


def test_report_carries_verified_numbers(catalog, example, provider_reply):
    with TestClient(create_app(catalog=catalog, ai_generator=lambda *_: provider_reply)) as client:
        response = client.post(
            "/api/report/executive-brief", json={"decisions": [d.model_dump(by_alias=True) for d in example]}
        )
        assert response.status_code == 200, response.text
        report = response.json()
        assert report["score_after"] == 56.54307 and report["budget"]["spent"] == 95
        assert len(report["districts"]) == 5 and report["markdown"]


@pytest.mark.parametrize("advice", [False, True])
def test_real_sdk_timeout_has_one_attempt_and_preserves_calculations(
    monkeypatch, catalog, example, caplog, advice
):
    sdk = pytest.importorskip("openai", reason="Install requirements-ai.txt for the SDK boundary check")
    httpx = pytest.importorskip("httpx2")
    from app.main import configured_generator

    attempts = []

    def timeout(request):
        attempts.append(request)
        raise httpx.ReadTimeout("private-provider-detail", request=request)

    sdk_client = sdk.OpenAI
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-sent")
    monkeypatch.setattr("app.main.load_dotenv", lambda *_args, **_kwargs: None)
    with httpx.Client(transport=httpx.MockTransport(timeout)) as transport:
        monkeypatch.setattr(sdk, "OpenAI", lambda **kwargs: sdk_client(http_client=transport, **kwargs))
        generator_field = "ai_advice_generator" if advice else "ai_generator"
        with TestClient(
            create_app(catalog=catalog, **{generator_field: configured_generator(advice=advice)})
        ) as client:
            payload = {"decisions": [d.model_dump(by_alias=True) for d in example]}
            response = client.post(
                "/api/ai/advice" if advice else "/api/explain", json={"decisions": []} if advice else payload
            )
            assert response.status_code == 503
            assert response.json()["code"] == "AI_UNAVAILABLE"
            assert "private-provider-detail" not in response.text + caplog.text
            result = client.post("/api/scenario/finalize", json=payload)
            assert result.status_code == 200 and result.json()["score"] == 56.54307
    assert len(attempts) == 1
    assert attempts[0].extensions["timeout"]["read"] == 45.0


def test_current_frontend_request_and_response(catalog, provider_reply):
    path = os.getenv("AKIM_FRONTEND_REQUEST")
    if not path:
        pytest.skip("Run the documented frontend Zod contract check to generate this request")
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    with TestClient(create_app(catalog=catalog, ai_generator=lambda *_: provider_reply)) as client:
        response = client.post("/api/ai/analyze", json=payload)
        assert response.status_code == 200, response.text
        Path(path).with_name("ai-response.json").write_text(
            json.dumps(response.json(), ensure_ascii=False), encoding="utf-8"
        )
