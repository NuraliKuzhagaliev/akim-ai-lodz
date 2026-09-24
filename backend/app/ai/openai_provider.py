"""OpenAI Responses API adapter for schema-constrained city analysis."""
import json
import os
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from .schemas import AdviceResponse, AnalysisResponse
from .service import JsonGenerator


class AIProviderError(RuntimeError):
    """Safe-to-display upstream AI configuration or request error."""


ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


def _load_local_backend_env() -> None:
    """Load simple KEY=VALUE entries from backend/.env without overriding env."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return

    for line in lines:
        item = line.strip()
        if not item or item.startswith("#"):
            continue
        if item.startswith("export "):
            item = item[7:].lstrip()
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def _create_openai_generator(
    response_model: type[ResponseModel],
    client: Any | None = None,
    model: str | None = None,
) -> JsonGenerator:
    _load_local_backend_env()
    selected_model = model or os.getenv("OPENAI_MODEL", "gpt-6-astra")
    active_client = client

    def generate(system_prompt: str, payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal active_client
        if active_client is None:
            if not os.getenv("OPENAI_API_KEY"):
                raise AIProviderError("OPENAI_API_KEY is not configured in backend/.env.")
            try:
                from openai import OpenAI
            except ImportError as exc:
                raise AIProviderError(
                    "The AI endpoint requires the 'openai' Python package."
                ) from exc
            active_client = OpenAI()

        try:
            response = active_client.responses.parse(
                model=selected_model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": json.dumps(payload, ensure_ascii=False),
                    },
                ],
                text_format=response_model,
            )
        except Exception as exc:
            # Avoid returning upstream request details that could contain secrets.
            raise AIProviderError("The AI provider request failed.") from exc

        parsed = response.output_parsed
        if parsed is None:
            raise AIProviderError(
                "The AI provider returned no structured result (refusal or incomplete response)."
            )
        return parsed.model_dump()

    return generate


def create_openai_json_generator(
    client: Any | None = None,
    model: str | None = None,
) -> JsonGenerator:
    """Return a lazy adapter for scenario analysis."""
    return _create_openai_generator(AnalysisResponse, client=client, model=model)


def create_openai_advice_generator(
    client: Any | None = None,
    model: str | None = None,
) -> JsonGenerator:
    """Return a lazy adapter for City Council suggestions."""
    return _create_openai_generator(AdviceResponse, client=client, model=model)

