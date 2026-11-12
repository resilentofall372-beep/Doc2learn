import io

from app.services import retrieval
from tests.conftest import upload


def test_upload_get_delete(client, document):
    headers, _, doc_id, project_id = document

    project = client.get(f"/api/projects/{project_id}", headers=headers).get_json()
    assert [d["_id"] for d in project["documents"]] == [doc_id]
    assert project["documents"][0]["chunk_count"] >= 1
    assert project["documents"][0]["number"] == 1
    assert "extracted_text" not in project["documents"][0]

    single = client.get(f"/api/document/{doc_id}", headers=headers).get_json()["document"]
    assert "Photosynthesis" in single["extracted_text"]

    assert client.delete(f"/api/document/{doc_id}", headers=headers).status_code == 200
    assert client.get(f"/api/document/{doc_id}", headers=headers).status_code == 404


def test_other_user_cannot_see_document(client, auth, document):
    _, _, doc_id, _ = document
    other_headers, _ = auth(email="eve@example.com", name="Eve")
    assert client.get(f"/api/document/{doc_id}", headers=other_headers).status_code == 404
    assert client.delete(f"/api/document/{doc_id}", headers=other_headers).status_code == 404


def test_rejects_bad_uploads(client, document):
    headers, _, _, project_id = document
    res = client.post(
        "/api/document/upload",
        data={"file": (io.BytesIO(b"x"), "virus.exe"), "project_id": project_id},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    assert upload(client, headers, project_id, text="too short", filename="tiny.txt").status_code == 422
    res = upload(client, headers, project_id, text="x" * 100, filename="../../etc/passwd.txt")
    assert res.status_code == 201
    assert res.get_json()["document"]["filename"] == "passwd.txt"
    # upload needs a project
    res = client.post(
        "/api/document/upload",
        data={"file": (io.BytesIO(b"x" * 100), "a.txt")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 400


def test_project_wide_retrieval_cites_the_right_file(app, client, document):
    headers, _, doc_id, project_id = document
    second = upload(
        client,
        headers,
        project_id,
        text="Hash tables map keys to values using a hash function. Collisions are resolved by chaining. " * 5,
        filename="hashing.txt",
    ).get_json()["document_id"]

    with app.app_context():
        scope = {"project_id": project_id, "document_id": None}
        hits = retrieval.search(scope, "how are hash collisions resolved", top_k=2)
        assert hits and hits[0]["document_id"] == second and hits[0]["filename"] == "hashing.txt"

        context, legend, used = retrieval.context_for(scope, "stomata")
        assert "[Doc 1, Page 1]" in context
        assert legend["1"]["filename"] == "notes.txt" and legend["2"]["filename"] == "hashing.txt"
        assert used[0]["document_id"] == doc_id

        only_first = retrieval.search({"project_id": project_id, "document_id": doc_id}, "hash collisions", top_k=5)
        assert all(h["document_id"] == doc_id for h in only_first)

        spread, _ = retrieval.spread_context(scope)
        assert "[Doc 1" in spread and "[Doc 2" in spread


def test_chunking_overlaps_and_covers():
    text = " ".join(f"Sentence number {i} is here." for i in range(200))
    chunks = retrieval.chunk_text(text, size=300, overlap=60)
    assert len(chunks) > 10
    assert all(len(c["text"]) <= 400 for c in chunks)
    assert "Sentence number 0" in chunks[0]["text"]
    assert "Sentence number 199" in chunks[-1]["text"]


def test_generation_endpoints(client, document):
    headers, _, doc_id, project_id = document
    whole = {"project_id": project_id}
    one = {"project_id": project_id, "document_id": doc_id}

    quiz = client.post("/api/document/generate-quiz", json={**whole, "num_questions": 2}, headers=headers)
    assert quiz.status_code == 200, quiz.get_json()
    body = quiz.get_json()
    assert body["quiz_id"] and len(body["questions"]) == 2
    assert body["questions"][0]["source_document"]["filename"] == "notes.txt"

    cards = client.post("/api/document/generate-flashcards", json=one, headers=headers)
    assert cards.status_code == 200
    assert cards.get_json()["flashcards"][0]["front"] == "Chlorophyll"
    saved = client.get("/api/flashcards/", query_string=one, headers=headers).get_json()
    assert saved["flashcards"][0]["back"] == "Green pigment"
    # the whole-project deck is separate from the single-document one
    assert client.get("/api/flashcards/", query_string=whole, headers=headers).get_json()["flashcards"] == []

    assert client.get("/api/mindmap/", query_string=whole, headers=headers).get_json()["mindmap"] is None
    mm = client.post("/api/document/generate-mindmap", json=whole, headers=headers)
    assert mm.status_code == 200
    assert client.get("/api/mindmap/", query_string=whole, headers=headers).get_json()["mindmap"]["central_topic"] == "Photosynthesis"


def test_document_from_another_project_is_rejected(client, document):
    headers, _, doc_id, _ = document
    other_project = client.post("/api/projects/", json={"name": "Other"}, headers=headers).get_json()["project"]["_id"]
    res = client.post("/api/document/generate-quiz", json={"project_id": other_project, "document_id": doc_id}, headers=headers)
    assert res.status_code == 404


def test_quiz_submission_and_stats(client, document):
    headers, _, doc_id, project_id = document
    quiz_id = client.post(
        "/api/document/generate-quiz", json={"project_id": project_id, "document_id": doc_id}, headers=headers
    ).get_json()["quiz_id"]

    res = client.post(
        "/api/quiz/submit",
        json={"quiz_id": quiz_id, "answers": {"0": "A", "1": "C"}, "time_spent_seconds": 95},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.get_json()
    assert (body["score"], body["total"], body["percentage"]) == (1, 2, 50)
    assert body["results"][1]["is_correct"] is False
    assert body["results"][1]["correct_answer"] == "B"

    stats = client.get(f"/api/projects/{project_id}/stats", headers=headers).get_json()["stats"]
    assert stats["quizzes_taken"] == 1
    assert stats["average_score"] == 50
    assert stats["study_time_label"] == "1m"
    assert stats["weakest_documents"][0]["document_id"] == doc_id

    attempts = client.get(f"/api/quiz/project/{project_id}", headers=headers).get_json()["attempts"]
    assert len(attempts) == 1


def test_assistant_flow(client, document):
    headers, _, doc_id, project_id = document

    empty = client.get(f"/api/assistant/chat/history/{project_id}", headers=headers).get_json()
    assert empty["messages"] == []

    chat = client.post("/api/assistant/chat", json={"project_id": project_id, "question": "Where does it happen?"}, headers=headers)
    assert chat.status_code == 200
    body = chat.get_json()
    assert body["sources"][0]["filename"] == "notes.txt" and body["sources"][0]["page"] == 1
    assert body["legend"]["1"]["document_id"] == doc_id
    assert body["confidence"] == "high"

    history = client.get(f"/api/assistant/chat/history/{project_id}", headers=headers).get_json()
    assert [m["role"] for m in history["messages"]] == ["user", "assistant"]

    assert client.post("/api/assistant/chat/clear", json={"session_id": body["session_id"]}, headers=headers).status_code == 200
    assert client.get(f"/api/assistant/chat/history/{project_id}", headers=headers).get_json()["messages"] == []

    for path, payload, key in (
        ("/api/assistant/summarize", {"project_id": project_id}, "summary"),
        ("/api/assistant/explain", {"project_id": project_id, "concept": "stomata"}, "explanation"),
        ("/api/assistant/practice", {"project_id": project_id, "document_id": doc_id, "topic": "general"}, "problems"),
        ("/api/assistant/study-plan", {"project_id": project_id, "weak_areas": ["Calvin cycle"], "days": 3}, "plan"),
    ):
        res = client.post(path, json=payload, headers=headers)
        assert res.status_code == 200, (path, res.get_json())
        assert res.get_json()[key]
