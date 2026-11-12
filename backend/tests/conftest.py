import io
import sys
from pathlib import Path

import mongomock
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402
from app.config import TestConfig  # noqa: E402
from app.extensions import socketio  # noqa: E402
from app.services import generation  # noqa: E402

SAMPLE_TEXT = (
    "Photosynthesis is the process by which green plants convert light energy into chemical energy. "
    "It takes place in the chloroplasts, which contain the pigment chlorophyll. "
    "The light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH. "
    "The Calvin cycle occurs in the stroma and fixes carbon dioxide into glucose. "
    "Stomata are small pores on leaves that regulate gas exchange and water loss. "
    "Cellular respiration is the complementary process that releases energy from glucose. "
    "Mitochondria are the organelles where aerobic respiration takes place. "
    "Enzymes such as RuBisCO catalyse key steps in carbon fixation. "
) * 3

FAKE_QUIZ = {
    "questions": [
        {
            "question": "Where does the Calvin cycle occur?",
            "options": {"A": "Stroma", "B": "Thylakoid", "C": "Nucleus", "D": "Cytoplasm"},
            "answer": "A",
            "explanation": "The Calvin cycle fixes carbon in the stroma.",
            "source_page": 1,
        },
        {
            "question": "Which pigment absorbs light?",
            "options": {"A": "Haemoglobin", "B": "Chlorophyll", "C": "Keratin", "D": "Melanin"},
            "answer": "B",
            "explanation": "Chlorophyll is the photosynthetic pigment.",
            "source_page": 1,
        },
    ]
}


@pytest.fixture()
def app(monkeypatch):
    db = mongomock.MongoClient().db
    application = create_app(TestConfig, db=db)

    def fake_complete_json(messages, **kwargs):
        prompt = messages[-1]["content"]
        if '"questions"' in prompt:
            return FAKE_QUIZ
        if '"flashcards"' in prompt:
            return {"flashcards": [{"front": "Chlorophyll", "back": "Green pigment", "source_page": 1}]}
        if '"central_topic"' in prompt:
            return {"central_topic": "Photosynthesis", "branches": [{"topic": "Light reactions", "subtopics": ["ATP", "NADPH"]}]}
        if '"summary"' in prompt:
            return {"summary": "Plants make glucose from light.", "key_points": ["Chloroplasts", "Calvin cycle"]}
        if '"problems"' in prompt:
            return {"problems": [{"question": "Explain the Calvin cycle.", "hint": "Think stroma.", "answer": "It fixes CO2."}]}
        if '"plan"' in prompt:
            return {"plan": [{"day": 1, "topic": "Light reactions", "activities": ["Read page 1"]}]}
        return {}

    def fake_complete(messages, **kwargs):
        return "Photosynthesis happens in chloroplasts [Page 1]."

    monkeypatch.setattr(generation, "complete_json", fake_complete_json)
    monkeypatch.setattr(generation, "complete", fake_complete)
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth(client):
    """Register a user and return (headers, user) for authenticated requests."""

    def _make(email="alex@example.com", name="Alex"):
        res = client.post("/api/auth/register", json={"name": name, "email": email, "password": "secret123"})
        assert res.status_code == 201, res.get_json()
        body = res.get_json()
        return {"Authorization": f"Bearer {body['token']}"}, body["user"]

    return _make


@pytest.fixture()
def document(client, auth):
    headers, user = auth()
    data = {"file": (io.BytesIO(SAMPLE_TEXT.encode()), "notes.txt")}
    res = client.post("/api/document/upload", data=data, headers=headers, content_type="multipart/form-data")
    assert res.status_code == 201, res.get_json()
    return headers, user, res.get_json()["document_id"]


@pytest.fixture()
def sio(app):
    def _connect(_flask_client=None):
        # Each socket gets its own session; auth happens via participant tokens, not cookies.
        return socketio.test_client(app)

    return _connect
