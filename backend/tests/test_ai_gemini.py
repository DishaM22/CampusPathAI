"""Tests for backend/ai_gemini.py (retry, fallback models and safe errors)."""

import pytest
from google.genai import errors as genai_errors

import ai_gemini
from ai_gemini import AIServiceError, generate_with_fallback


def server_error(code=503):
    return genai_errors.ServerError(
        code, {"error": {"code": code, "message": "high demand", "status": "UNAVAILABLE"}}
    )


def client_error(code, message="x"):
    return genai_errors.ClientError(
        code, {"error": {"code": code, "message": message, "status": "X"}}
    )


class Response:
    def __init__(self, text, finish_reason=None):
        self.text = text
        self.candidates = (
            [type("Candidate", (), {"finish_reason": finish_reason})()]
            if finish_reason is not None
            else []
        )


class FakeClient:
    """Returns/raises the scripted outcome for each call, in order."""

    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = []          # model name of every call
        self.models = self       # client.models.generate_content(...)

    def generate_content(self, model, contents, config):
        self.calls.append(model)
        self.configs = getattr(self, "configs", []) + [config]
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        if isinstance(outcome, Response):
            return outcome
        return Response(outcome)


no_sleep = lambda seconds: None


def run(outcomes, models=("primary", "backup"), **kwargs):
    client = FakeClient(outcomes)
    result = generate_with_fallback(
        client, "prompt", models=list(models), sleep=no_sleep, **kwargs
    )
    return result, client


def test_first_call_success():
    result, client = run(["  Hello!  "])
    assert result == "Hello!"
    assert client.calls == ["primary"]


def test_a_503_is_retried_on_the_same_model():
    result, client = run([server_error(), "Recovered"])
    assert result == "Recovered"
    assert client.calls == ["primary", "primary"]


def test_after_repeated_503_the_fallback_model_is_used():
    result, client = run([server_error(), server_error(), "From backup"])
    assert result == "From backup"
    assert client.calls == ["primary", "primary", "backup"]


def test_all_models_overloaded_gives_a_friendly_503():
    with pytest.raises(AIServiceError) as info:
        run([server_error()] * 4)
    assert info.value.status_code == 503
    assert info.value.public_message == ai_gemini.BUSY_MESSAGE
    assert "503" not in info.value.public_message
    assert "UNAVAILABLE" not in info.value.public_message


def test_429_moves_to_the_next_model_without_retrying():
    result, client = run([client_error(429), "Other model has quota"])
    assert result == "Other model has quota"
    assert client.calls == ["primary", "backup"]


def test_429_on_every_model_gives_a_rate_limit_message():
    with pytest.raises(AIServiceError) as info:
        run([client_error(429), client_error(429)])
    assert info.value.status_code == 429


def test_unknown_model_name_falls_through_to_the_next_model():
    result, client = run([client_error(404), "ok"])
    assert result == "ok"
    assert client.calls == ["primary", "backup"]


@pytest.mark.parametrize("code", [400, 401, 403])
def test_bad_api_key_stops_immediately_with_a_config_message(code):
    with pytest.raises(AIServiceError) as info:
        run([client_error(code), "never reached"])
    assert info.value.status_code == 502
    assert info.value.public_message == ai_gemini.CONFIG_MESSAGE


def test_timeout_goes_to_the_next_model_without_retrying():
    result, client = run([TimeoutError("slow"), "fast model"])
    assert result == "fast model"
    assert client.calls == ["primary", "backup"]


def test_empty_response_returns_an_empty_string():
    result, _ = run([None])
    assert result == ""


def test_deadline_stops_further_attempts():
    ticks = iter([0.0, 100.0, 100.0, 100.0, 100.0, 100.0])
    client = FakeClient([server_error()] * 4)
    with pytest.raises(AIServiceError):
        generate_with_fallback(
            client, "p", models=["a", "b"], sleep=no_sleep,
            clock=lambda: next(ticks), deadline_seconds=45.0,
        )
    assert client.calls == []   # deadline already passed, nothing was called


def test_model_candidates_from_environment(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "main-model")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", " lite-model , main-model,, other ")
    assert ai_gemini.model_candidates() == ["main-model", "lite-model", "other"]


def test_model_candidates_default(monkeypatch):
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_FALLBACK_MODELS", raising=False)
    assert ai_gemini.model_candidates() == [ai_gemini.DEFAULT_MODEL]


def test_bad_model_name_format_is_skipped_not_fatal():
    """The exact error Google returns for a placeholder like MODEL_NAME."""
    bad_name = client_error(
        400, "* GenerateContentRequest.model: unexpected model name format"
    )
    result, client = run([bad_name, "answer from the next model"])
    assert result == "answer from the next model"
    assert client.calls == ["primary", "backup"]


def test_invalid_api_key_400_is_still_a_config_error():
    with pytest.raises(AIServiceError) as info:
        run([client_error(400, "API key not valid. Please pass a valid API key.")])
    assert info.value.public_message == ai_gemini.CONFIG_MESSAGE


def test_only_bad_model_names_gives_a_config_message():
    bad = client_error(404, "model not found")
    with pytest.raises(AIServiceError) as info:
        run([bad, bad])
    assert info.value.status_code == 502
    assert info.value.public_message == ai_gemini.CONFIG_MESSAGE


def test_default_output_limit_is_large_enough_for_thinking_models(monkeypatch):
    monkeypatch.delenv("GEMINI_MAX_OUTPUT_TOKENS", raising=False)
    _, client = run(["ok"])
    assert client.configs[0]["max_output_tokens"] == ai_gemini.DEFAULT_MAX_OUTPUT_TOKENS
    assert ai_gemini.DEFAULT_MAX_OUTPUT_TOKENS >= 2048


def test_output_limit_can_be_set_from_environment(monkeypatch):
    monkeypatch.setenv("GEMINI_MAX_OUTPUT_TOKENS", "3000")
    _, client = run(["ok"])
    assert client.configs[0]["max_output_tokens"] == 3000

    monkeypatch.setenv("GEMINI_MAX_OUTPUT_TOKENS", "99999")
    assert ai_gemini.max_output_tokens_from_env() == 8192

    monkeypatch.setenv("GEMINI_MAX_OUTPUT_TOKENS", "banana")
    assert ai_gemini.max_output_tokens_from_env() == ai_gemini.DEFAULT_MAX_OUTPUT_TOKENS


def test_truncated_answer_is_marked_honestly():
    class Reason:
        name = "MAX_TOKENS"

    result, _ = run([Response("Here is how you", finish_reason=Reason())])
    assert result.startswith("Here is how you")
    assert result.endswith(ai_gemini.TRUNCATION_NOTE)


def test_complete_answer_is_not_marked():
    class Reason:
        name = "STOP"

    result, _ = run([Response("A full answer.", finish_reason=Reason())])
    assert result == "A full answer."