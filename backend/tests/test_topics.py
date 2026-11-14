from tests.conftest import make_project, upload


def _outline(client, headers, project_id):
    res = client.get("/api/topics/", query_string={"project_id": project_id}, headers=headers)
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def test_paste_text_becomes_a_document(client, auth):
    headers, _ = auth()
    project_id = make_project(client, headers)

    short = client.post("/api/document/paste", json={"project_id": project_id, "title": "x", "text": "too short"}, headers=headers)
    assert short.status_code == 400

    res = client.post(
        "/api/document/paste",
        json={"project_id": project_id, "title": "Lecture notes", "text": "Chlorophyll absorbs light in the chloroplasts. " * 5},
        headers=headers,
    )
    assert res.status_code == 201, res.get_json()
    doc = res.get_json()["document"]
    assert doc["filename"] == "Lecture notes.txt"
    assert doc["number"] == 1 and doc["chunk_count"] >= 1
    assert client.get(f"/api/projects/{project_id}", headers=headers).get_json()["project"]["document_count"] == 1


def test_build_update_and_tag(client, document):
    headers, _, doc_id, project_id = document

    empty = _outline(client, headers, project_id)
    assert empty["outline"] is None and empty["pending_documents"] == []

    built = client.post("/api/topics/build", json={"project_id": project_id}, headers=headers).get_json()
    topics = built["outline"]["topics"]
    assert [t["title"] for t in topics] == ["Light reactions", "Calvin cycle"]
    assert topics[0]["sources"][0]["document_id"] == doc_id
    assert built["pending_documents"] == []
    calvin_id = topics[1]["id"]

    # A second document shows up as pending, then gets merged in without changing existing ids.
    upload(client, headers, project_id, filename="respiration.txt")
    pending = _outline(client, headers, project_id)["pending_documents"]
    assert [p["filename"] for p in pending] == ["respiration.txt"]

    updated = client.post("/api/topics/build", json={"project_id": project_id}, headers=headers).get_json()
    topics = updated["outline"]["topics"]
    assert [t["title"] for t in topics] == ["Light reactions", "Calvin cycle", "Respiration"]
    assert topics[1]["id"] == calvin_id
    assert topics[1]["subtopics"] == ["Stroma", "RuBisCO", "Glucose"]
    assert len(topics[1]["sources"]) == 2
    assert updated["pending_documents"] == []

    # A quiz on one topic tags every question with it, and grading keeps the tag.
    quiz = client.post("/api/document/generate-quiz", json={"project_id": project_id, "topic_id": calvin_id}, headers=headers).get_json()
    assert quiz["topic_id"] == calvin_id
    assert all(q["topic_id"] == calvin_id for q in quiz["questions"])
    graded = client.post("/api/quiz/submit", json={"quiz_id": quiz["quiz_id"], "answers": {"0": "A"}}, headers=headers).get_json()
    assert all(r["topic_id"] == calvin_id for r in graded["results"])

    # Topic decks are kept apart from the whole-project deck.
    client.post("/api/document/generate-flashcards", json={"project_id": project_id, "topic_id": calvin_id}, headers=headers)
    deck = client.get("/api/flashcards/", query_string={"project_id": project_id, "topic_id": calvin_id}, headers=headers).get_json()
    assert deck["flashcards"][0]["topic_id"] == calvin_id and deck["generated_at"]
    general = client.get("/api/flashcards/", query_string={"project_id": project_id}, headers=headers).get_json()
    assert general["flashcards"] == []

    unknown = client.post("/api/document/generate-quiz", json={"project_id": project_id, "topic_id": "nope"}, headers=headers)
    assert unknown.status_code == 404


def test_edit_outline_and_delete_document(client, document):
    headers, _, doc_id, project_id = document
    topics = client.post("/api/topics/build", json={"project_id": project_id}, headers=headers).get_json()["outline"]["topics"]
    light, calvin = topics

    edited = client.put(
        "/api/topics/",
        json={
            "project_id": project_id,
            "topics": [
                {"id": calvin["id"], "title": "Carbon fixation", "subtopics": ["Stroma"]},
                {"title": "My own topic", "summary": "Added by hand", "sources": [{"document_id": "forged", "page": 9}]},
                {"id": light["id"], "title": light["title"], "subtopics": light["subtopics"]},
            ],
        },
        headers=headers,
    ).get_json()["outline"]["topics"]
    assert [t["title"] for t in edited] == ["Carbon fixation", "My own topic", "Light reactions"]
    assert edited[0]["id"] == calvin["id"] and edited[0]["sources"] == calvin["sources"]
    assert edited[1]["sources"] == []  # clients can't invent sources

    assert client.put("/api/topics/", json={"project_id": project_id, "topics": [{"title": " "}]}, headers=headers).status_code == 400

    # Deleting the only document drops the topics that came from it, but keeps hand-made ones.
    client.delete(f"/api/document/{doc_id}", headers=headers)
    left = _outline(client, headers, project_id)["outline"]["topics"]
    assert [t["title"] for t in left] == ["My own topic"]


def test_concept_map_follows_the_outline(client, document):
    headers, _, _, project_id = document
    topics = client.post("/api/topics/build", json={"project_id": project_id}, headers=headers).get_json()["outline"]["topics"]
    mindmap = client.post("/api/document/generate-mindmap", json={"project_id": project_id}, headers=headers).get_json()["mindmap"]
    branch = mindmap["branches"][0]
    assert branch["topic"] == "Light reactions" and branch["topic_id"] == topics[0]["id"]
    # Older "subtopics" strings become concepts with empty notes.
    assert branch["concepts"] == [{"label": "ATP", "note": ""}, {"label": "NADPH", "note": ""}]
    assert mindmap["links"] == []


def test_not_covered_answers_are_low_confidence():
    from app.services.generation import _confidence

    used = [{"doc": 1, "page": 1}]
    for answer in (
        "The provided documents do not contain information regarding the capital of Andhra Pradesh.",
        "This isn't mentioned in your notes.",
        "I couldn't find anything about that in the excerpts.",
        "There is no information about tax law here.",
    ):
        assert _confidence(used, answer, []) == "low", answer
    assert _confidence(used, "Chlorophyll absorbs light [Doc 1, Page 1].", [{"doc": 1}]) == "high"
    assert _confidence(used, "Chlorophyll absorbs light.", []) == "medium"


def test_outline_is_private(client, document, auth):
    headers, _, _, project_id = document
    client.post("/api/topics/build", json={"project_id": project_id}, headers=headers)

    eve, _ = auth(email="eve@example.com", name="Eve")
    assert client.get("/api/topics/", query_string={"project_id": project_id}, headers=eve).status_code == 404
    assert client.post("/api/topics/build", json={"project_id": project_id}, headers=eve).status_code == 404
    assert client.put("/api/topics/", json={"project_id": project_id, "topics": []}, headers=eve).status_code == 404
    assert client.post("/api/document/paste", json={"project_id": project_id, "title": "x", "text": "y" * 50}, headers=eve).status_code == 404
