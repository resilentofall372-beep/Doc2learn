from datetime import datetime, timedelta

from app.extensions import Collections, get_db
from app.services import srs
from app.services.progress import next_step


# --------------------------------------------------------------------------- scheduler
def test_schedule_grows_and_resets():
    now = datetime(2026, 1, 1, 12, 0)
    first = srs.schedule(None, "good", now)
    assert first["interval_days"] == 1 and first["reps"] == 1
    second = srs.schedule(first, "good", now)
    assert second["interval_days"] == 3
    third = srs.schedule(second, "good", now)
    assert third["interval_days"] == round(3 * 2.5)
    assert third["due_at"] == now + timedelta(days=third["interval_days"])

    forgot = srs.schedule(third, "again", now)
    assert forgot["reps"] == 0 and forgot["lapses"] == 1 and forgot["interval_days"] == 0
    assert forgot["due_at"] == now + timedelta(minutes=10)
    assert forgot["ease"] < third["ease"]

    easy = srs.schedule(None, "easy", now)
    assert easy["interval_days"] == 3 and easy["ease"] > 2.5


def test_card_key_is_stable_without_ids():
    card = {"front": "Chlorophyll", "back": "Green pigment"}
    assert srs.card_key(card) == srs.card_key(dict(card)) != srs.card_key({"front": "x", "back": "y"})
    assert srs.card_key({"id": "abc", **card}) == "abc"


# --------------------------------------------------------------------------- next step
def test_next_step_order():
    topic = lambda i, mastery, status, due=0: {  # noqa: E731
        "id": f"t{i}", "title": f"T{i}", "summary": "", "mastery": mastery, "status": status,
        "quiz": {"answered": 0, "correct": 0}, "cards": {"due": due},
    }
    assert next_step(document_count=0, has_outline=False, pending_documents=0, due=0, topics=[])["kind"] == "add_documents"
    assert next_step(document_count=1, has_outline=False, pending_documents=0, due=0, topics=[])["kind"] == "build_outline"
    assert next_step(document_count=2, has_outline=True, pending_documents=1, due=0, topics=[])["kind"] == "update_outline"
    topics = [topic(1, 90, "mastered"), topic(2, 40, "learning"), topic(3, None, "not_started")]
    assert next_step(document_count=1, has_outline=True, pending_documents=0, due=2, topics=topics)["kind"] == "review"
    weak = next_step(document_count=1, has_outline=True, pending_documents=0, due=0, topics=topics)
    assert weak["kind"] == "strengthen" and weak["topic_id"] == "t2"
    # A started topic is finished before the next one is started (outline order).
    topics[1] = topic(2, 70, "learning")
    step = next_step(document_count=1, has_outline=True, pending_documents=0, due=0, topics=topics)
    assert step["kind"] == "test_topic" and step["topic_id"] == "t2"
    topics[1] = topic(2, 90, "mastered")
    step = next_step(document_count=1, has_outline=True, pending_documents=0, due=0, topics=topics)
    assert step["kind"] == "start_topic" and step["topic_id"] == "t3"
    # Reading the explanation ("Learn it") moves the topic on to testing.
    topics[2] = {**topic(3, None, "not_started"), "learned": True}
    step = next_step(document_count=1, has_outline=True, pending_documents=0, due=0, topics=topics)
    assert step["kind"] == "test_topic" and step["topic_id"] == "t3"
    # Weak means a low accuracy, not just little evidence.
    few = {**topic(3, 20, "learning"), "accuracy": 100}
    assert next_step(document_count=1, has_outline=True, pending_documents=0, due=0, topics=[topics[0], topics[1], few])["kind"] == "test_topic"
    done = [topic(1, 90, "mastered")]
    assert next_step(document_count=1, has_outline=True, pending_documents=0, due=0, topics=done)["kind"] == "all_mastered"


# --------------------------------------------------------------------------- end to end
def _overview(client, headers, project_id):
    res = client.get(f"/api/projects/{project_id}/overview", headers=headers)
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def test_reviews_mastery_plan_and_today(app, client, document):
    headers, _, doc_id, project_id = document

    first = _overview(client, headers, project_id)
    assert first["next_step"]["kind"] == "build_outline" and first["saved_plan"] is None

    topics = client.post("/api/topics/build", json={"project_id": project_id}, headers=headers).get_json()["outline"]["topics"]
    light, calvin = topics
    step = _overview(client, headers, project_id)["next_step"]
    assert step["kind"] == "start_topic" and step["topic_id"] == light["id"]

    # Quiz on "Calvin cycle": answer 1 of 2 right -> 50% accuracy, but only 2 of 5 pieces of
    # evidence, so 20% mastery; learning, and the weakest topic.
    quiz = client.post("/api/document/generate-quiz", json={"project_id": project_id, "topic_id": calvin["id"]}, headers=headers).get_json()
    client.post("/api/quiz/submit", json={"quiz_id": quiz["quiz_id"], "answers": {"0": "A", "1": "C"}}, headers=headers)
    ov = _overview(client, headers, project_id)
    row = {t["id"]: t for t in ov["topics"]}
    assert row[calvin["id"]]["accuracy"] == 50 and row[calvin["id"]]["mastery"] == 20
    assert row[calvin["id"]]["status"] == "learning"
    assert row[light["id"]]["status"] == "not_started"
    assert ov["next_step"]["kind"] == "strengthen" and ov["next_step"]["topic_id"] == calvin["id"]

    # Rate a Calvin card; force it due; it shows up in /due and as the next step.
    deck = client.post("/api/document/generate-flashcards", json={"project_id": project_id, "topic_id": calvin["id"]}, headers=headers).get_json()
    card = deck["flashcards"][0]
    assert card["id"]
    # Unrated cards count as new, not as "all caught up".
    assert _overview(client, headers, project_id)["new_cards"] == len(deck["flashcards"])
    bad = client.post("/api/flashcards/review", json={"project_id": project_id, "card": card, "rating": "meh"}, headers=headers)
    assert bad.status_code == 400
    rated = client.post("/api/flashcards/review", json={"project_id": project_id, "card": card, "rating": "good"}, headers=headers).get_json()
    assert rated["interval_days"] == 1 and rated["card_id"] == card["id"]
    assert client.get("/api/flashcards/due", query_string={"project_id": project_id}, headers=headers).get_json()["count"] == 0

    with app.app_context():
        get_db()[Collections.CARD_REVIEWS].update_many({}, {"$set": {"due_at": datetime.utcnow() - timedelta(hours=1)}})
    due = client.get("/api/flashcards/due", query_string={"project_id": project_id}, headers=headers).get_json()
    assert due["count"] == 1 and due["cards"][0]["front"] == card["front"] and due["cards"][0]["topic_id"] == calvin["id"]
    ov = _overview(client, headers, project_id)
    assert ov["due_cards"] == 1 and ov["next_step"]["kind"] == "review"
    assert ov["new_cards"] == len(deck["flashcards"]) - 1
    assert {t["id"]: t for t in ov["topics"]}[calvin["id"]]["status"] == "review_due"

    # The deck view knows each card's schedule.
    shown = client.get("/api/flashcards/", query_string={"project_id": project_id, "topic_id": calvin["id"]}, headers=headers).get_json()
    assert shown["schedule"][card["id"]]["last_rating"] == "good"

    # A whole-project plan is saved, defaults to the weakest topics, and can be ticked off.
    plan = client.post("/api/assistant/study-plan", json={"project_id": project_id, "days": 3}, headers=headers).get_json()
    assert plan["weak_areas"] == ["Calvin cycle"]
    assert plan["saved_plan"]["today"] == 1 and plan["saved_plan"]["finished"] is False
    ticked = client.post(f"/api/assistant/study-plan/{project_id}/done", json={"day": 1}, headers=headers).get_json()
    assert ticked["saved_plan"]["done"] == [1]
    assert _overview(client, headers, project_id)["saved_plan"]["done"] == [1]

    # Today, across projects.
    today = client.get("/api/stats/today", headers=headers).get_json()
    assert today["due_cards"] == 1
    entry = today["projects"][0]
    assert entry["_id"] == project_id and entry["weakest_topic"]["title"] == "Calvin cycle"
    assert entry["plan_today"]["day"] == 1 and entry["plan_today"]["done"] is True

    # Deleting the document drops reviews of its cards.
    client.delete(f"/api/document/{doc_id}", headers=headers)
    assert client.get("/api/flashcards/due", query_string={"project_id": project_id}, headers=headers).get_json()["count"] == 0


def test_progress_is_private(client, document, auth):
    headers, _, _, project_id = document
    eve, _ = auth(email="eve@example.com", name="Eve")
    assert client.get(f"/api/projects/{project_id}/overview", headers=eve).status_code == 404
    assert client.get("/api/flashcards/due", query_string={"project_id": project_id}, headers=eve).status_code == 404
    card = {"front": "a", "back": "b"}
    assert client.post("/api/flashcards/review", json={"project_id": project_id, "card": card, "rating": "good"}, headers=eve).status_code == 404
    assert client.get(f"/api/assistant/study-plan/{project_id}", headers=eve).status_code == 404
    assert client.get("/api/stats/today", headers=eve).get_json()["projects"] == []
