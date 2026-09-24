import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app

# Optional independent checkout of the AI participant, for integration checks before merge.
if os.getenv("AKIM_AI_REFERENCE"):
    app.__path__.append(os.environ["AKIM_AI_REFERENCE"])

from app.main import create_app
from app.models.schemas import ScenarioRequest
from app.simulation.catalog import load_catalog


@pytest.fixture(scope="session")
def catalog():
    return load_catalog()


@pytest.fixture
def example():
    path = Path(__file__).resolve().parents[2] / "shared" / "example-scenario.json"
    return ScenarioRequest.model_validate(json.loads(path.read_text(encoding="utf-8"))).decisions


@pytest.fixture
def client(catalog):
    with TestClient(create_app(catalog=catalog)) as client:
        yield client
