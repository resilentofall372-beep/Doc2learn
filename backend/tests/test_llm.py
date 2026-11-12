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
    app.config["OPENROUTER_API_KEY"] = ""
    headers, _ = auth()
    import io

    doc = client.post(
        "/api/document/upload",
        data={"file": (io.BytesIO(b"Some reasonably long text about plants and chloroplasts " * 5), "n.txt")},
        headers=headers,
        content_type="multipart/form-data",
    ).get_json()
    res = client.post("/api/document/generate-quiz", json={"document_id": doc["document_id"]}, headers=headers)
    assert res.status_code == 503
    assert "OPENROUTER_API_KEY" in res.get_json()["error"]
