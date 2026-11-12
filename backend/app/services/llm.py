"""The single place the app talks to a language model.

All calls go through OpenRouter's OpenAI-compatible endpoint, so the model can
be swapped by changing `LLM_MODEL` without touching any feature code.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from flask import current_app
from openai import APIError, APITimeoutError, OpenAI, RateLimitError

from ..errors import ApiError

log = logging.getLogger(__name__)

_client_cache: dict[str, OpenAI] = {}


class LLMUnavailable(ApiError):
    def __init__(self, message: str):
        super().__init__(message, 503)


def _client() -> OpenAI:
    cfg = current_app.config
    key = cfg["OPENROUTER_API_KEY"]
    if not key:
        raise LLMUnavailable(
            "No model provider configured. Set OPENROUTER_API_KEY in backend/.env."
        )
    cache_key = f"{cfg['OPENROUTER_BASE_URL']}|{key[-6:]}"
    if cache_key not in _client_cache:
        _client_cache[cache_key] = OpenAI(
            api_key=key,
            base_url=cfg["OPENROUTER_BASE_URL"],
            timeout=cfg["LLM_TIMEOUT_SECONDS"],
            max_retries=1,
            default_headers={
                # OpenRouter uses these for attribution on its dashboard; both optional.
                "HTTP-Referer": "https://github.com/Utkarshjain1217/Doc2learn",
                "X-Title": "Doc2Learn",
            },
        )
    return _client_cache[cache_key]


def llm_status() -> dict:
    cfg = current_app.config
    return {
        "provider": "openrouter",
        "model": cfg["LLM_MODEL"],
        "configured": bool(cfg["OPENROUTER_API_KEY"]),
    }


def complete(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
    json_mode: bool = False,
) -> str:
    """Return the assistant text for a chat completion.

    Raises LLMUnavailable (503) on provider failures so routes surface a clear
    message instead of silently degrading.
    """
    cfg = current_app.config
    kwargs: dict[str, Any] = {
        "model": cfg["LLM_MODEL"],
        "messages": messages,
        "temperature": cfg["LLM_TEMPERATURE"] if temperature is None else temperature,
        "max_tokens": max_tokens or cfg["LLM_MAX_TOKENS"],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        try:
            response = _client().chat.completions.create(**kwargs)
        except APIError as exc:
            # Some OpenRouter models reject response_format; retry without it.
            if json_mode and getattr(exc, "status_code", None) in (400, 404, 422):
                kwargs.pop("response_format", None)
                response = _client().chat.completions.create(**kwargs)
            else:
                raise
    except RateLimitError as exc:
        log.warning("LLM rate limited: %s", exc)
        raise LLMUnavailable("The model provider is rate limiting requests. Try again shortly.")
    except APITimeoutError:
        raise LLMUnavailable("The model took too long to respond. Try again.")
    except APIError as exc:
        log.error("LLM request failed: %s", exc)
        raise LLMUnavailable(f"Model request failed: {getattr(exc, 'message', str(exc))[:200]}")

    choice = response.choices[0] if response.choices else None
    content = (choice.message.content if choice and choice.message else "") or ""
    if not content.strip():
        raise LLMUnavailable("The model returned an empty response.")
    return content.strip()


_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def parse_json(text: str) -> Any:
    """Extract a JSON object/array from model output that may contain prose or fences."""
    candidates = [text.strip()]
    candidates += [m.strip() for m in _FENCE_RE.findall(text)]
    first_obj = text.find("{")
    last_obj = text.rfind("}")
    if first_obj != -1 and last_obj > first_obj:
        candidates.append(text[first_obj : last_obj + 1])
    first_arr = text.find("[")
    last_arr = text.rfind("]")
    if first_arr != -1 and last_arr > first_arr:
        candidates.append(text[first_arr : last_arr + 1])
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    raise LLMUnavailable("The model did not return valid JSON. Try again.")


def complete_json(messages: list[dict[str, str]], **kwargs) -> Any:
    """Chat completion whose answer is parsed as JSON (with one repair attempt)."""
    text = complete(messages, json_mode=True, **kwargs)
    try:
        return parse_json(text)
    except LLMUnavailable:
        repair = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "That was not valid JSON. Reply with only the corrected JSON."},
        ]
        return parse_json(complete(repair, json_mode=True, **kwargs))
