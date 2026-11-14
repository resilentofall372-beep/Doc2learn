"""How far a learner has got with each topic, and what they should do next.

Mastery (0-100) comes from two kinds of evidence per topic:
- quiz answers: the share right among the latest 20 answers to questions tagged with the topic;
- flashcards: the share of the topic's reviewed cards whose last rating was good or easy.
Quiz answers weigh more (70/30) because they are graded, while card ratings are self-reported.

Status per topic:
- not_started: no quiz answers and no card reviews yet;
- review_due:  flashcards for it are due now;
- mastered:    mastery >= 80 with at least 4 quiz answers;
- learning:    anything in between.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from ..extensions import Collections, get_db

RECENT_ANSWERS = 20
MASTERED_AT = 80
MIN_ANSWERS_FOR_MASTERY = 4
WEAK_BELOW = 60


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    # PyMongo returns naive datetimes that are UTC.
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def due_count(user_id: str, project_id: str, now: datetime | None = None) -> int:
    return get_db()[Collections.CARD_REVIEWS].count_documents(
        {"user_id": user_id, "project_id": project_id, "due_at": {"$lte": (now or _now()).replace(tzinfo=None)}}
    )


def topic_progress(user_id: str, project_id: str, topics: list[dict], now: datetime | None = None) -> list[dict]:
    """Progress for every topic in the outline, in outline order."""
    now = now or _now()
    db = get_db()

    answers: dict[str, list[bool]] = defaultdict(list)
    attempts = db[Collections.QUIZ_ATTEMPTS].find(
        {"user_id": user_id, "project_id": project_id},
        {"results.topic_id": 1, "results.is_correct": 1},
    ).sort("submitted_at", -1)
    for attempt in attempts:
        for result in attempt.get("results") or []:
            topic_id = result.get("topic_id")
            if topic_id and len(answers[topic_id]) < RECENT_ANSWERS:
                answers[topic_id].append(bool(result.get("is_correct")))

    cards: dict[str, dict] = defaultdict(lambda: {"reviewed": 0, "due": 0, "known": 0})
    for review in db[Collections.CARD_REVIEWS].find(
        {"user_id": user_id, "project_id": project_id, "topic_id": {"$ne": None}},
        {"topic_id": 1, "due_at": 1, "last_rating": 1},
    ):
        bucket = cards[review["topic_id"]]
        bucket["reviewed"] += 1
        if review.get("last_rating") in ("good", "easy"):
            bucket["known"] += 1
        due = _as_utc(review.get("due_at"))
        if due and due <= now:
            bucket["due"] += 1

    rows = []
    for topic in topics:
        given = answers.get(topic["id"], [])
        card = cards.get(topic["id"], {"reviewed": 0, "due": 0, "known": 0})
        answered, correct = len(given), sum(given)

        parts = []
        if answered:
            parts.append((0.7, correct / answered))
        if card["reviewed"]:
            parts.append((0.3, card["known"] / card["reviewed"]))
        mastery = round(100 * sum(w * v for w, v in parts) / sum(w for w, _ in parts)) if parts else None

        if mastery is None:
            status = "not_started"
        elif card["due"]:
            status = "review_due"
        elif mastery >= MASTERED_AT and answered >= MIN_ANSWERS_FOR_MASTERY:
            status = "mastered"
        else:
            status = "learning"

        rows.append(
            {
                "id": topic["id"],
                "title": topic["title"],
                "summary": topic.get("summary", ""),
                "subtopics": topic.get("subtopics", []),
                "mastery": mastery,
                "status": status,
                "quiz": {"answered": answered, "correct": correct},
                "cards": card,
            }
        )
    return rows


def next_step(*, document_count: int, has_outline: bool, pending_documents: int, due: int, topics: list[dict]) -> dict:
    """The single most useful thing to do now. The frontend turns `kind` into a link."""
    if document_count == 0:
        return {"kind": "add_documents", "title": "Add your study material", "detail": "Upload notes, slides or chapters, or paste text."}
    if not has_outline:
        return {"kind": "build_outline", "title": "Build the topic outline", "detail": "Split your documents into topics to study one at a time."}
    if pending_documents:
        noun = "document" if pending_documents == 1 else "documents"
        return {"kind": "update_outline", "title": f"Add {pending_documents} new {noun} to the outline", "detail": "So their topics show up in your progress."}
    if due:
        noun = "card is" if due == 1 else "cards are"
        return {"kind": "review", "title": f"Review {due} flashcards", "detail": f"{due} {noun} due. Short reviews now keep them from slipping.", "count": due}

    started = [t for t in topics if t["mastery"] is not None]
    weak = sorted((t for t in started if t["status"] != "mastered" and t["mastery"] < WEAK_BELOW), key=lambda t: t["mastery"])
    if weak:
        t = weak[0]
        return {"kind": "strengthen", "title": f"Strengthen “{t['title']}”", "detail": f"Mastery {t['mastery']}%. Re-learn it, then take a short quiz.", "topic_id": t["id"], "topic_title": t["title"]}
    fresh = [t for t in topics if t["status"] == "not_started"]
    if fresh:
        t = fresh[0]
        return {"kind": "start_topic", "title": f"Start “{t['title']}”", "detail": t.get("summary") or "Learn it, then check yourself with a quiz.", "topic_id": t["id"], "topic_title": t["title"]}
    pending = sorted((t for t in started if t["status"] != "mastered"), key=lambda t: t["mastery"])
    if pending:
        t = pending[0]
        return {"kind": "test_topic", "title": f"Test yourself on “{t['title']}”", "detail": f"Mastery {t['mastery']}%. A few more right answers will lock it in.", "topic_id": t["id"], "topic_title": t["title"]}
    if topics:
        return {"kind": "all_mastered", "title": "Every topic is mastered", "detail": "Keep it fresh with a mixed, hard quiz across the project."}
    return {"kind": "build_outline", "title": "Add topics to the outline", "detail": "The outline is empty. Rebuild it or add topics by hand."}


def project_overview(user_id: str, project_id: str) -> dict:
    """Everything the Overview tab and the Today panel need for one project."""
    db = get_db()
    now = _now()
    outline = db[Collections.TOPICS].find_one({"project_id": project_id, "user_id": user_id})
    topics = outline["topics"] if outline else []
    doc_ids = [str(d["_id"]) for d in db[Collections.DOCUMENTS].find({"project_id": project_id, "user_id": user_id}, {"_id": 1})]
    covered = set(outline.get("document_ids", [])) if outline else set()
    pending = len([d for d in doc_ids if d not in covered]) if outline else 0

    progress = topic_progress(user_id, project_id, topics, now)
    due = due_count(user_id, project_id, now)
    started = [t for t in progress if t["mastery"] is not None]
    return {
        "document_count": len(doc_ids),
        "has_outline": outline is not None,
        "pending_documents": pending,
        "topics": progress,
        "due_cards": due,
        "summary": {
            "topics": len(progress),
            "mastered": sum(1 for t in progress if t["status"] == "mastered"),
            "started": len(started),
            "average_mastery": round(sum(t["mastery"] for t in started) / len(started)) if started else None,
        },
        "next_step": next_step(
            document_count=len(doc_ids), has_outline=outline is not None, pending_documents=pending, due=due, topics=progress
        ),
    }
