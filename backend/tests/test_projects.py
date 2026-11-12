from datetime import datetime, timezone

from app.extensions import Collections, get_db
from app.migrations import LEGACY_PROJECT_NAME, move_loose_documents_into_projects
from tests.conftest import make_project, upload


def test_create_list_rename_delete(client, auth):
    headers, _ = auth()
    assert client.get("/api/projects/", headers=headers).get_json()["projects"] == []

    bad = client.post("/api/projects/", json={"name": "   "}, headers=headers)
    assert bad.status_code == 400

    created = client.post("/api/projects/", json={"name": "Biology 101", "description": "Term 1", "color": "c3"}, headers=headers)
    assert created.status_code == 201
    project = created.get_json()["project"]
    assert (project["name"], project["description"], project["color"]) == ("Biology 101", "Term 1", "c3")

    upload(client, headers, project["_id"])
    listing = client.get("/api/projects/", headers=headers).get_json()["projects"]
    assert listing[0]["_id"] == project["_id"] and listing[0]["document_count"] == 1

    renamed = client.patch(f"/api/projects/{project['_id']}", json={"name": "Bio"}, headers=headers)
    assert renamed.get_json()["project"]["name"] == "Bio"

    assert client.delete(f"/api/projects/{project['_id']}", headers=headers).status_code == 200
    assert client.get(f"/api/projects/{project['_id']}", headers=headers).status_code == 404


def test_projects_are_private(client, auth):
    owner_headers, _ = auth()
    project_id = make_project(client, owner_headers)
    doc_id = upload(client, owner_headers, project_id).get_json()["document_id"]

    eve_headers, _ = auth(email="eve@example.com", name="Eve")
    assert client.get("/api/projects/", headers=eve_headers).get_json()["projects"] == []
    for method, path, body in (
        ("get", f"/api/projects/{project_id}", None),
        ("patch", f"/api/projects/{project_id}", {"name": "mine now"}),
        ("delete", f"/api/projects/{project_id}", None),
        ("get", f"/api/projects/{project_id}/stats", None),
        ("get", f"/api/assistant/chat/history/{project_id}", None),
        ("post", "/api/assistant/chat", {"project_id": project_id, "question": "hi"}),
        ("post", "/api/document/generate-quiz", {"project_id": project_id}),
        ("post", "/api/room/create", {"project_id": project_id, "room_name": "x"}),
    ):
        res = getattr(client, method)(path, json=body, headers=eve_headers)
        assert res.status_code == 404, (method, path, res.status_code)
    # Eve can't upload into it or read its document either
    assert upload(client, eve_headers, project_id).status_code == 404
    assert client.get(f"/api/document/{doc_id}", headers=eve_headers).status_code == 404
    # and the owner still has everything
    assert client.get(f"/api/projects/{project_id}", headers=owner_headers).get_json()["project"]["name"] == "Biology 101"


def test_delete_cascades(app, client, document):
    headers, user, doc_id, project_id = document
    client.post("/api/document/generate-quiz", json={"project_id": project_id}, headers=headers)
    client.post("/api/assistant/chat", json={"project_id": project_id, "question": "hi"}, headers=headers)
    assert client.delete(f"/api/projects/{project_id}", headers=headers).status_code == 200
    with app.app_context():
        db = get_db()
        for name in (Collections.DOCUMENTS, Collections.CHUNKS, Collections.QUIZZES, Collections.CHAT_SESSIONS):
            assert db[name].count_documents({"project_id": project_id}) == 0, name


def test_migration_moves_loose_documents(app):
    with app.app_context():
        db = get_db()
        now = datetime.now(timezone.utc)
        doc_id = str(db[Collections.DOCUMENTS].insert_one({"user_id": "u1", "filename": "old.pdf", "uploaded_on": now}).inserted_id)
        db[Collections.CHUNKS].insert_one({"document_id": doc_id, "index": 0, "text": "x"})
        db[Collections.QUIZZES].insert_one({"document_id": doc_id, "user_id": "u1", "questions": []})

        assert move_loose_documents_into_projects(db) == 1
        project = db[Collections.PROJECTS].find_one({"user_id": "u1"})
        assert project["name"] == LEGACY_PROJECT_NAME
        pid = str(project["_id"])
        assert db[Collections.DOCUMENTS].find_one({"filename": "old.pdf"})["project_id"] == pid
        assert db[Collections.CHUNKS].find_one({"document_id": doc_id})["project_id"] == pid
        assert db[Collections.CHUNKS].find_one({"document_id": doc_id})["filename"] == "old.pdf"
        assert db[Collections.QUIZZES].find_one({"document_id": doc_id})["project_id"] == pid

        # running again changes nothing
        assert move_loose_documents_into_projects(db) == 0
        assert db[Collections.PROJECTS].count_documents({"user_id": "u1"}) == 1
