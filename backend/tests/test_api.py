from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def body(decisions):
    return {"decisions": [d.model_dump(by_alias=True) for d in decisions]}


def test_catalog_and_health(client):
    assert client.get("/api/health").json()["status"] == "ok"
    districts = client.get("/api/districts").json()
    measures = client.get("/api/measures").json()
    assert len(districts) == 5 and len(measures) == 14
    assert districts[0]["id"] == "esil"
    assert districts[0]["populationShare"] == 0.27
    assert set(districts[0]["indicators"]) == {"T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"}
    assert next(m for m in measures if m["id"] == "M11")["effects"]["T1"] == -2
    assert all("notes" in m and "description" in m for m in measures)
    assert client.get("/api/bootstrap").json()["before"]["score"] == 52.55768


def test_official_end_to_end(client, example):
    response = client.post("/api/scenario/finalize", json=body(example))
    assert response.status_code == 200
    result = response.json()
    assert result["validation"] == {"status": "valid", "errors": []}
    assert result["before"]["score"] == 52.55768
    assert result["after"]["score"] == 56.54307
    assert result["scoreDelta"] == pytest.approx(3.98539)
    assert result["budget"] == {"total": 100, "spent": 95, "remaining": 5}
    assert result["finalized"] and result["score"] == 56.54307
    assert len(result["contributions"]) == 5
    assert sum(c["scoreImpact"] for c in result["contributions"]) == pytest.approx(result["scoreDelta"])
    assert "districtId" not in next(d for d in result["decisions"] if d["measureId"] == "M12")
    assert "districtId" not in next(d for d in result["contributions"] if d["measureId"] == "M12")
    assert result["after"]["criticalCount"] == 0


def test_preview_and_invalid_finalize(client):
    preview = client.post("/api/simulate", json={"decisions": []}).json()
    assert preview["before"] == preview["after"]
    assert preview["score"] is None and not preview["finalized"]
    assert "Предварительный" in preview["notice"]
    final = client.post("/api/scenario/finalize", json={"decisions": []}).json()
    assert final["validation"]["status"] == "invalid"
    assert final["after"] is None and final["scoreDelta"] is None


def test_domain_error_keeps_frontend_envelope(client):
    response = client.post(
        "/api/simulate",
        json={
            "decisions": [
                {"measureId": "M1", "districtId": "nura"},
                {"measureId": "M3", "districtId": "esil"},
            ]
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["validation"]["errors"][0]["code"] == "INCOMPATIBLE_MEASURES"
    assert result["after"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"decisions": None},
        {"decisions": "M7"},
        {"decisions": [None]},
        {"decisions": [{"measureId": 7}]},
        {"decisions": [{"measureId": True}]},
        {"decisions": [{"measureId": "M7", "cost": 0}]},
        {"decisions": [], "score": 100},
        {"decisions": [], "budget": 100000},
        {"decisions": [{"measureId": "M12"}] * 101},
    ],
)
def test_malformed_and_forged_requests_rejected(client, payload):
    response = client.post("/api/scenario/finalize", json=payload)
    assert response.status_code == 422
    assert response.json()["score"] is None


def test_bad_json_is_not_internal_error(client):
    response = client.post("/api/simulate", content="{bad json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422 and response.json()["code"] == "INVALID_REQUEST"


def test_ai_missing_does_not_break_simulation(client, example):
    result = client.post("/api/scenario/finalize", json=body(example)).json()
    response = client.post("/api/ai/analyze", json={"simulation": result})
    assert response.status_code == 503
    assert response.json()["code"] == "AI_UNAVAILABLE"
    assert client.post("/api/scenario/finalize", json=body(example)).json()["after"] == result["after"]


def test_ai_cannot_skip_validation(client):
    response = client.post("/api/ai/analyze", json={"simulation": {"decisions": [], "after": {"score": 100}}})
    assert response.status_code == 422


def test_cors_and_openapi(catalog):
    with TestClient(create_app(catalog=catalog, cors_origins=["http://127.0.0.1:3000"])) as client:
        good = client.options(
            "/api/simulate",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert good.status_code == 200
        assert good.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
        bad = client.get("/api/health", headers={"Origin": "https://other.example"})
        assert "access-control-allow-origin" not in bad.headers
        schema = client.get("/openapi.json").json()
        assert {"/api/simulate", "/api/recommend", "/api/scenario/finalize", "/api/ai/analyze"} <= schema[
            "paths"
        ].keys()
        assert "measureId" in schema["components"]["schemas"]["Decision"]["properties"]


def test_concurrent_requests_have_no_shared_mutation(client, example):
    def request(index):
        payload = body(example) if index % 2 else {"decisions": []}
        return client.post("/api/simulate", json=payload).json()["after"]["score"]

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(request, range(12)))
    assert results == [52.55768 if i % 2 == 0 else 56.54307 for i in range(12)]
