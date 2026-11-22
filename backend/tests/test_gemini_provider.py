import json

import httpx2
from fastapi.testclient import TestClient

from app.ai import gemini_provider
from app.main import configured_generator, create_app


def test_gemini_adapter_serves_all_four_routes(monkeypatch, catalog, example):
    decisions = [decision.model_dump(by_alias=True) for decision in example]
    alternative = [*decisions[:-1], {"measureId": "M3", "districtId": "nura"}]
    scenario = {"decisions": [{"measure_id": d.measure_id, "district_id": d.district_id} for d in example]}
    analysis = {
        "strengths": [{"text": "Улучшение.", "evidence": ["score_after"]}],
        "risks": [],
        "tradeoffs": [],
        "recommendations": [],
        "answer": None,
    }
    advice = {
        "priority": "Экология",
        "reason": "Проверить доступную меру.",
        "suggestions": [{"measure_id": "M5", "district_id": "nura"}],
    }
    payloads = []

    def respond(request):
        assert str(request.url) == (
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"
        )
        assert request.headers["x-goog-api-key"] == "fixture-key"
        body = json.loads(request.content)
        assert body["systemInstruction"]["parts"][0]["text"]
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        schema = body["generationConfig"]["responseJsonSchema"]
        payloads.append(json.loads(body["contents"][0]["parts"][0]["text"]))
        reply = advice if "selected_decisions" in payloads[-1] else analysis
        assert set(schema["properties"]) == set(reply)
        return httpx2.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [{"text": "Reasoning", "thought": True}, {"text": json.dumps(reply)}]
                        },
                    }
                ]
            },
        )

    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "fixture-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.setattr("app.main.load_dotenv", lambda *_args, **_kwargs: None)
    factory = gemini_provider.create_gemini_generator
    with httpx2.Client(transport=httpx2.MockTransport(respond)) as transport:
        monkeypatch.setattr(
            gemini_provider, "create_gemini_generator", lambda *a, **kw: factory(*a, client=transport, **kw)
        )
        app = create_app(
            catalog=catalog,
            ai_generator=configured_generator(),
            ai_advice_generator=configured_generator(advice=True),
        )
        with TestClient(app) as client:
            assert client.get("/api/health").json()["aiConfigured"] is True
            cases = [
                ("/api/ai/analyze", {"scenario": scenario}, "strengths", analysis["strengths"]),
                ("/api/ai/advice", {"decisions": [decisions[0]]}, "suggestions", advice["suggestions"]),
                (
                    "/api/ai/compare",
                    {"originalDecisions": decisions, "alternativeDecisions": alternative},
                    "analysis",
                    analysis,
                ),
                ("/api/report/executive-brief", {"decisions": decisions}, "score_after", 56.54307),
            ]
            for endpoint, payload, field, expected in cases:
                result = client.post(endpoint, json=payload)
                assert result.status_code == 200, result.text
                assert result.json()[field] == expected
    assert len(payloads) == 4
    assert payloads[0]["scenario"]["budget"]["spent"] == 95
    assert payloads[2]["alternative"]["score_after"] == 57.20556


def test_gemini_quota_failure_keeps_calculation_working(catalog, example, caplog):
    def respond(_request):
        return httpx2.Response(429, json={"error": "private-upstream-details"})

    decisions = {"decisions": [d.model_dump(by_alias=True) for d in example]}
    with httpx2.Client(transport=httpx2.MockTransport(respond)) as transport:
        generator = gemini_provider.create_gemini_generator("fixture-key", client=transport)
        with TestClient(create_app(catalog=catalog, ai_generator=generator)) as client:
            response = client.post("/api/report/executive-brief", json=decisions)
            assert response.status_code == 503
            assert response.json()["code"] == "AI_UNAVAILABLE"
            assert "private-upstream-details" not in response.text + caplog.text
            result = client.post("/api/scenario/finalize", json=decisions)
            assert result.status_code == 200 and result.json()["score"] == 56.54307
