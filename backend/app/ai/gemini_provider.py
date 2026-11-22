"""Gemini API adapter for structured analysis and advice."""

import json
import re
from contextlib import nullcontext
from typing import Any

import httpx2

from .schemas import AdviceResponse, AnalysisResponse
from .service import JsonGenerator

DEFAULT_MODEL = "gemini-3.1-flash-lite"


class GeminiProviderError(RuntimeError):
    """A provider failure whose message is safe to expose."""


def create_gemini_generator(
    api_key: str,
    *,
    advice: bool = False,
    model: str = DEFAULT_MODEL,
    client: httpx2.Client | None = None,
) -> JsonGenerator:
    if not api_key.strip() or not re.fullmatch(r"gemini-[a-z0-9][a-z0-9.-]{0,63}", model):
        raise GeminiProviderError("Invalid Gemini configuration.")

    response_model = AdviceResponse if advice else AnalysisResponse
    schema = response_model.model_json_schema()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def generate(system_prompt: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": json.dumps(payload, ensure_ascii=False)}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
                "maxOutputTokens": 2048,
            },
        }
        try:
            with nullcontext(client) if client is not None else httpx2.Client(timeout=45.0) as transport:
                response = transport.post(
                    url, headers={"x-goog-api-key": api_key}, json=body, follow_redirects=False
                )
                response.raise_for_status()
        except httpx2.HTTPError:
            raise GeminiProviderError("The Gemini request failed.") from None

        try:
            candidate = response.json()["candidates"][0]
            if candidate["finishReason"] != "STOP":
                raise GeminiProviderError("Gemini did not complete the response.")
            parts = candidate["content"]["parts"]
            output = "".join(part.get("text", "") for part in parts if not part.get("thought"))
            return response_model.model_validate_json(output).model_dump()
        except (AttributeError, IndexError, KeyError, TypeError, ValueError):
            raise GeminiProviderError("Gemini returned no valid structured response.") from None

    return generate
