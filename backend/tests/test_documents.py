import io

from app.services import retrieval


def test_upload_list_get_delete(client, document):
    headers, _, doc_id = document

    listing = client.get("/api/document/", headers=headers).get_json()
    assert [d["_id"] for d in listing["documents"]] == [doc_id]
    assert listing["documents"][0]["chunk_count"] >= 1
    assert "extracted_text" not in listing["documents"][0]

    single = client.get(f"/api/document/{doc_id}", headers=headers).get_json()["document"]
    assert "Photosynthesis" in single["extracted_text"]

    assert client.delete(f"/api/document/{doc_id}", headers=headers).status_code == 200
    assert client.get(f"/api/document/{doc_id}", headers=headers).status_code == 404


def test_other_user_cannot_read_document(client, auth, document):
    _, _, doc_id = document
    other_headers, _ = auth(email="eve@example.com", name="Eve")
    assert client.get(f"/api/document/{doc_id}", headers=other_headers).status_code == 403
    assert client.delete(f"/api/document/{doc_id}", headers=other_headers).status_code == 403
    assert client.get("/api/document/", headers=other_headers).get_json()["documents"] == []


def test_rejects_bad_uploads(client, auth):
    headers, _ = auth()
    res = client.post(
        "/api/document/upload",
        data={"file": (io.BytesIO(b"x"), "virus.exe")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    res = client.post(
        "/api/document/upload",
        data={"file": (io.BytesIO(b"too short"), "tiny.txt")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 422
    res = client.post(
        "/api/document/upload",
        data={"file": (io.BytesIO(b"x" * 100), "../../etc/passwd.txt")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    assert res.get_json()["document"]["filename"] == "etc_passwd.txt"


def test_retrieval_finds_relevant_chunk(app, document):
    _, _, doc_id = document
    with app.app_context():
        hits = retrieval.search(doc_id, "where does the Calvin cycle happen", top_k=2)
        assert hits and "Calvin" in hits[0]["text"]
        context, pages = retrieval.context_for(doc_id, "stomata")
        assert "Stomata" in context
        assert pages == [1]


def test_chunking_overlaps_and_covers():
    text = " ".join(f"Sentence number {i} is here." for i in range(200))
    chunks = retrieval.chunk_text(text, size=300, overlap=60)
    assert len(chunks) > 10
    assert all(len(c["text"]) <= 400 for c in chunks)
    assert "Sentence number 0" in chunks[0]["text"]
    assert "Sentence number 199" in chunks[-1]["text"]


def test_generation_endpoints(client, document):
    headers, _, doc_id = document

    quiz = client.post("/api/document/generate-quiz", json={"document_id": doc_id, "num_questions": 2}, headers=headers)
    assert quiz.status_code == 200, quiz.get_json()
    body = quiz.get_json()
    assert body["quiz_id"] and len(body["questions"]) == 2
    assert body["questions"][0]["options"]["A"] == "Stroma"

    cards = client.post("/api/document/generate-flashcards", json={"document_id": doc_id}, headers=headers)
    assert cards.status_code == 200
    assert cards.get_json()["flashcards"][0]["front"] == "Chlorophyll"
    saved = client.get(f"/api/flashcards/document/{doc_id}", headers=headers).get_json()
    assert saved["flashcards"][0]["back"] == "Green pigment"

    assert client.get(f"/api/mindmap/document/{doc_id}", headers=headers).get_json()["mindmap"] is None
    mm = client.post("/api/document/generate-mindmap", json={"document_id": doc_id}, headers=headers)
    assert mm.status_code == 200
    assert client.get(f"/api/mindmap/document/{doc_id}", headers=headers).get_json()["mindmap"]["central_topic"] == "Photosynthesis"

    listing = client.get("/api/document/", headers=headers).get_json()
    assert listing["documents"][0]["quiz_count"] == 1


def test_quiz_submission_and_stats(client, document):
    headers, _, doc_id = document
    quiz_id = client.post("/api/document/generate-quiz", json={"document_id": doc_id}, headers=headers).get_json()["quiz_id"]

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

    stats = client.get("/api/stats/me", headers=headers).get_json()["stats"]
    assert stats["quizzes_taken"] == 1
    assert stats["average_score"] == 50
    assert stats["study_time_label"] == "1m"
    assert stats["weakest_documents"][0]["document_id"] == doc_id

    attempts = client.get(f"/api/quiz/document/{doc_id}", headers=headers).get_json()["attempts"]
    assert len(attempts) == 1


def test_assistant_flow(client, document):
    headers, _, doc_id = document

    empty = client.get(f"/api/assistant/chat/history/{doc_id}", headers=headers).get_json()
    assert empty["messages"] == []

    chat = client.post("/api/assistant/chat", json={"document_id": doc_id, "question": "Where does it happen?"}, headers=headers)
    assert chat.status_code == 200
    body = chat.get_json()
    assert body["sources"] == [1]
    assert body["confidence"] == "high"

    history = client.get(f"/api/assistant/chat/history/{doc_id}", headers=headers).get_json()
    assert [m["role"] for m in history["messages"]] == ["user", "assistant"]

    assert client.post("/api/assistant/chat/clear", json={"session_id": body["session_id"]}, headers=headers).status_code == 200
    assert client.get(f"/api/assistant/chat/history/{doc_id}", headers=headers).get_json()["messages"] == []

    for path, payload, key in (
        ("/api/assistant/summarize", {"document_id": doc_id}, "summary"),
        ("/api/assistant/explain", {"document_id": doc_id, "concept": "stomata"}, "explanation"),
        ("/api/assistant/practice", {"document_id": doc_id, "topic": "general"}, "problems"),
        ("/api/assistant/study-plan", {"document_id": doc_id, "weak_areas": ["Calvin cycle"], "days": 3}, "plan"),
    ):
        res = client.post(path, json=payload, headers=headers)
        assert res.status_code == 200, (path, res.get_json())
        assert res.get_json()[key]
