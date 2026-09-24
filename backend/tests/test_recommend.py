from app.models.schemas import Decision
from app.simulation.engine import calculate
from app.simulation.recommend import candidates, recommend
from app.simulation.validation import validate


def test_best_replacement_exhaustive(catalog, example):
    result = recommend(example, catalog)
    assert result.found
    assert len(set(example) - set(result.decisions)) == 1
    assert len(set(result.decisions) - set(example)) == 1
    assert not validate(result.decisions, catalog, finalize=True)
    best_score = calculate(result.decisions, catalog).score
    # Independently enumerate replacements rather than relying on candidate helper.
    count = 0
    for i in range(5):
        for measure in catalog.measures.values():
            for district in [None] if measure.scope == "city" else catalog.districts:
                changed = [
                    *example[:i],
                    Decision(measure_id=measure.id, district_id=district),
                    *example[i + 1 :],
                ]
                if not validate(changed, catalog, finalize=True):
                    assert calculate(changed, catalog).score <= best_score
                    count += 1
    assert count > 1
    assert result.result.after.score > 56.54307
    assert recommend(list(reversed(example)), catalog).model_dump() == result.model_dump()


def test_relocation_is_considered(catalog, example):
    assert any(
        set(d.measure_id for d in candidate) == set(d.measure_id for d in example)
        and set(candidate) != set(example)
        for candidate in candidates(example, catalog)
    )


def test_stops_at_local_optimum(catalog, example):
    current = example
    for _ in range(25):
        result = recommend(current, catalog)
        if not result.found:
            assert result.result is None and result.decisions is None
            assert result.candidates_checked > 0
            break
        current = result.decisions
    else:
        raise AssertionError("No local optimum found within 25 strictly improving changes")


def test_recommend_rejects_incomplete(client):
    response = client.post("/api/recommend", json={"decisions": []})
    assert response.status_code == 422 and response.json()["score"] is None
