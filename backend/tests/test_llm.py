import pytest

from app.services.llm import LLMUnavailable, parse_json


def test_parse_json_variants():
    assert parse_json('{"a": 1}') == {"a": 1}
    assert parse_json('Sure! ```json\n{"a": [1, 2]}\n```') == {"a": [1, 2]}
    assert parse_json('Here you go: {"questions": []} hope it helps') == {"questions": []}
    assert parse_json("[1, 2, 3]") == [1, 2, 3]
    with pytest.raises(LLMUnavailable):
        parse_json("no json here")


def test_missing_key_gives_clear_503(client, auth, app, monkeypatch):
    from app.services import generation
    from app.services import llm

    monkeypatch.setattr(generation, "complete_json", lambda *a, **k: llm.complete_json(*a, **k))
    app.config["LLM_API_KEY"] = ""
    from tests.conftest import make_project, upload

    headers, _ = auth()
    project_id = make_project(client, headers)
    upload(client, headers, project_id, text="Some reasonably long text about plants and chloroplasts " * 5)
    res = client.post("/api/document/generate-quiz", json={"project_id": project_id}, headers=headers)
    assert res.status_code == 503
    assert "LLM_API_KEY" in res.get_json()["error"]


def test_falls_back_to_next_model(app, monkeypatch):
    from app.services import llm

    app.config["LLM_MODEL"] = "busy-model"
    app.config["LLM_FALLBACK_MODELS"] = ["empty-model", "good-model"]
    calls = []

    def fake_once(model, *args):
        calls.append(model)
        if model == "busy-model":
            raise llm._Retryable("Model busy-model is unavailable right now (HTTP 503).")
        if model == "empty-model":
            return ""
        return "answer from good-model"

    monkeypatch.setattr(llm, "_complete_once", fake_once)
    with app.app_context():
        assert llm.complete([{"role": "user", "content": "hi"}]) == "answer from good-model"
    assert calls == ["busy-model", "empty-model", "good-model"]


def test_all_models_failing_gives_clear_error(app, monkeypatch):
    from app.services import llm

    app.config["LLM_MODEL"] = "a"
    app.config["LLM_FALLBACK_MODELS"] = ["b"]

    def always_busy(model, *args):
        raise llm._Retryable(f"Model {model} is unavailable right now (HTTP 503).")

    monkeypatch.setattr(llm, "_complete_once", always_busy)
    with app.app_context():
        with pytest.raises(llm.LLMUnavailable) as err:
            llm.complete([{"role": "user", "content": "hi"}])
    assert "All configured models were tried" in err.value.message
