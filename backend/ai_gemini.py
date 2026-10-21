"""
ai_gemini.py

Calls Gemini for the CampusPath AI chat assistant and handles the failures
that are normal on the free tier:

  * 503 UNAVAILABLE ("model is experiencing high demand")  -> retry briefly,
    then try the next model in the fallback list
  * 429 (quota / rate limit; free-tier limits are per model) -> try the next model
  * 404 (model name not available to this key)               -> try the next model
  * 400 / 401 / 403 (bad or missing API key)                  -> stop, config problem
  * timeouts and network errors                               -> next model, no retry

Raw Google error text is only written to the server log. The student only
ever sees a short, friendly message (AIServiceError.public_message).

Environment variables (backend/.env):
  GEMINI_API_KEY            required
  GEMINI_MODEL              primary model (default below)
  GEMINI_FALLBACK_MODELS    optional, comma separated, tried in order
"""

from __future__ import annotations

import logging
import os
import random
import time
from typing import Any, Callable, List, Optional

from google.genai import errors as genai_errors

logger = logging.getLogger("campuspath.chat")

DEFAULT_MODEL = "gemini-3.6-flash"

# Gemini 3 models spend part of this budget on internal "thinking", so a small
# limit (such as 800) can cut the visible answer off mid-sentence.
DEFAULT_MAX_OUTPUT_TOKENS = 2048

TRUNCATION_NOTE = (
    "\n\n(The answer was cut short. Ask me to continue or to be briefer.)"
)

# Total time one chat request may spend talking to Gemini.
DEFAULT_DEADLINE_SECONDS = 45.0

BUSY_MESSAGE = (
    "The AI assistant is very busy right now. "
    "Please wait a minute and try again."
)
RATE_LIMIT_MESSAGE = (
    "The AI assistant has reached its usage limit for now. "
    "Please try again in a few minutes."
)
CONFIG_MESSAGE = (
    "The AI assistant is not set up correctly. "
    "Please tell the project owner to check the backend settings."
)
GENERIC_MESSAGE = (
    "The AI assistant ran into a problem. Please try again."
)


class AIServiceError(Exception):
    """An error that is safe to show to the student."""

    def __init__(self, status_code: int, public_message: str) -> None:
        super().__init__(public_message)
        self.status_code = status_code
        self.public_message = public_message


def max_output_tokens_from_env() -> int:
    """GEMINI_MAX_OUTPUT_TOKENS, limited to a sensible range."""
    try:
        value = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", ""))
    except ValueError:
        return DEFAULT_MAX_OUTPUT_TOKENS
    return max(256, min(8192, value))


def _was_truncated(response: Any) -> bool:
    """True when Gemini stopped because it hit the output-token limit."""
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return False

    reason = getattr(candidates[0], "finish_reason", None)
    name = str(getattr(reason, "name", reason) or "")
    return name.upper().endswith("MAX_TOKENS")


def _is_model_name_problem(exc: Exception) -> bool:
    """
    A 400 can mean "bad API key" or "bad model name". Only the second one
    should make us skip to the next model.
    """
    text = str(exc).lower()
    return (
        "model" in text
        and "api key" not in text
        and "api_key" not in text
    )


def model_candidates() -> List[str]:
    """Primary model first, then the optional fallbacks, without duplicates."""
    primary = os.getenv("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    fallbacks = os.getenv("GEMINI_FALLBACK_MODELS", "").split(",")

    ordered: List[str] = []
    for name in [primary, *fallbacks]:
        name = name.strip()
        if name and name not in ordered:
            ordered.append(name)

    return ordered


def generate_with_fallback(
    client: Any,
    prompt: str,
    *,
    max_output_tokens: Optional[int] = None,
    temperature: float = 0.5,
    retries_per_model: int = 2,
    deadline_seconds: float = DEFAULT_DEADLINE_SECONDS,
    models: Optional[List[str]] = None,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> str:
    """
    Returns the model's text (possibly an empty string if the model returned
    nothing, e.g. blocked content). Raises AIServiceError if every model fails.
    """
    candidates = models or model_candidates()
    token_limit = max_output_tokens or max_output_tokens_from_env()
    started = clock()

    saw_overload = False
    saw_rate_limit = False
    saw_bad_model = False

    for model in candidates:
        for attempt in range(1, retries_per_model + 1):

            if clock() - started > deadline_seconds:
                logger.warning("AI chat deadline reached before %s", model)
                break

            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={
                        "max_output_tokens": token_limit,
                        "temperature": temperature,
                    },
                )
                text = (getattr(response, "text", None) or "").strip()

                if text and _was_truncated(response):
                    logger.warning(
                        "Gemini %s hit the output limit (%s tokens)",
                        model, token_limit,
                    )
                    text += TRUNCATION_NOTE

                return text

            except genai_errors.ServerError as exc:
                # 5xx, including 503 "high demand": worth a short retry
                saw_overload = True
                logger.warning(
                    "Gemini %s server error %s (attempt %s/%s)",
                    model, getattr(exc, "code", "?"), attempt,
                    retries_per_model,
                )
                if attempt < retries_per_model:
                    sleep(1.5 * attempt + random.uniform(0.0, 0.5))
                continue

            except genai_errors.ClientError as exc:
                code = getattr(exc, "code", None)
                logger.warning("Gemini %s client error %s", model, code)

                if code == 429:
                    saw_rate_limit = True
                    break  # quota is per model: try the next one

                if code == 404 or (code == 400 and _is_model_name_problem(exc)):
                    saw_bad_model = True
                    logger.error(
                        "Gemini model %r is not usable (check GEMINI_MODEL / "
                        "GEMINI_FALLBACK_MODELS): %s", model, exc,
                    )
                    break  # wrong model name: try the next one

                if code in (400, 401, 403):
                    logger.error("Gemini rejected the request: %s", exc)
                    raise AIServiceError(502, CONFIG_MESSAGE)

                raise AIServiceError(502, GENERIC_MESSAGE)

            except Exception as exc:  # timeouts, network problems
                saw_overload = True
                logger.warning(
                    "Gemini %s call failed (%s): %s",
                    model, type(exc).__name__, exc,
                )
                break  # do not wait on a slow model again: next model

    if saw_overload:
        raise AIServiceError(503, BUSY_MESSAGE)

    if saw_rate_limit:
        raise AIServiceError(429, RATE_LIMIT_MESSAGE)

    if saw_bad_model:
        raise AIServiceError(502, CONFIG_MESSAGE)

    raise AIServiceError(502, GENERIC_MESSAGE)