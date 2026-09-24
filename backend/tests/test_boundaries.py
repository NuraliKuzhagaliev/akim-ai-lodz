import importlib
from dataclasses import replace
from types import SimpleNamespace

import pytest

from app.main import configured_generator
from app.simulation.engine import calculate
from app.simulation.recommend import recommend
from app.simulation.service import ai_snapshot, simulate


def test_ai_rejects_previews(catalog):
    with pytest.raises(ValueError, match="finalized"):
        ai_snapshot(simulate([], catalog), catalog)


def test_recommend_rejects_invalid_direct_call(catalog):
    with pytest.raises(ValueError, match="five-decision"):
        recommend([], catalog)


def test_remaining_budget_does_not_add_score(catalog, example):
    # Increasing available budget cannot change the score of the same decisions.
    assert calculate(example, replace(catalog, budget=1000)).score == calculate(example, catalog).score


def test_provider_configuration_without_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr("app.main.load_dotenv", lambda *_args, **_kwargs: None)
    assert configured_generator() is None


def test_provider_configuration_and_bounded_timeout(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-sent")
    monkeypatch.setattr("app.main.load_dotenv", lambda *_args, **_kwargs: None)
    captured = {}

    def client(**kwargs):
        captured.update(kwargs)
        return object()

    def expected(*_args):
        return {}

    modules = {
        "openai": SimpleNamespace(OpenAI=client),
        "app.ai.openai_provider": SimpleNamespace(create_openai_json_generator=lambda **_kwargs: expected),
    }
    original = importlib.import_module
    monkeypatch.setattr(
        "app.main.importlib.import_module", lambda name: modules[name] if name in modules else original(name)
    )
    assert configured_generator() is expected
    assert captured == {"timeout": 45.0, "max_retries": 0}


def test_provider_configuration_failure_keeps_backend_running(monkeypatch, caplog):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-sent")
    monkeypatch.setattr("app.main.load_dotenv", lambda *_args, **_kwargs: None)

    def fail(_name):
        raise ImportError("private-configuration-details")

    monkeypatch.setattr("app.main.importlib.import_module", fail)
    assert configured_generator() is None
    assert "private-configuration-details" not in caplog.text
