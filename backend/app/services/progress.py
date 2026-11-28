"""How far a learner has got with each topic, and what they should do next.

Mastery (0-100) comes from two kinds of evidence per topic:
- quiz answers: the share right among the latest 20 answers to questions tagged with the topic;
- flashcards: the share of the topic's reviewed cards whose last rating was good or easy.
Quiz answers weigh more (70/30) because they are graded, while card ratings are self-reported.
That share is `accuracy`. Mastery is the weighted share right with PRIOR_ANSWERS extra wrong
answers mixed in (a card rating counts as half an answer), so one lucky answer reads as 33%, not
100%, and every right answer raises it while every wrong one lowers it: 1/1 is 33%, 1/2 is 25%,
5/5 is 71%, 10/10 is 83%.

Status per topic:
- not_started: no quiz answers, no card reviews and no explanation read yet;
- review_due:  flashcards for it are due now;
- mastered:    mastery >= 80 with at least 5 quiz answers and, if it has reviewed cards,
               one card that has come back after a gap of 3+ days (spaced review);
- learning:    anything in between (including "read the explanation, not tested yet").

`learned` is set once the learner has generated an explanation of the topic ("Learn it").
Cards are `new` while they sit in the topic's latest deck without ever being rated.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from ..extensions import Collections, get_db
from . import srs
from ..utils import as_utc, utcnow

RECENT_ANSWERS = 20
MASTERED_AT = 80
MIN_ANSWERS_FOR_MASTERY = 5
PRIOR_ANSWERS = 2  # imaginary wrong answers every topic starts with, so little evidence reads low
CARD_WEIGHT = 0.5  # a self-rated card counts as half a graded quiz answer
SPACED_DAYS = 3  # a reviewed card's interval must reach this before the topic counts as mastered
WEAK_BELOW = 60


def _latest_decks(user_id: str, project_id: str) -> list[dict]:
    """The newest deck per (document, topic): the ones the Flashcards page shows."""
    latest: dict[tuple, dict] = {}
    for deck in get_db()[Collections.FLASHCARDS].find(
        {"user_id": user_id, "project_id": project_id},
        {"document_id": 1, "topic_id": 1, "flashcards": 1, "created_at": 1},
    ).sort("created_at", -1):
        latest.setdefault((deck.get("document_id"), deck.get("topic_id")), deck)
    return list(latest.values())


def new_cards(user_id: str, project_id: str, reviewed_keys: set[str] | None = None) -> dict[str | None, int]:
    """Never-rated cards in the latest decks, counted per topic id (None = no topic)."""
    if reviewed_keys is None:
        reviewed_keys = {
            r["card_key"]
            for r in get_db()[Collections.CARD_REVIEWS].find({"user_id": user_id, "project_id": project_id}, {"card_key": 1})
        }
    counts: dict[str | None, int] = defaultdict(int)
    seen: set[str] = set()
    for deck in _latest_decks(user_id, project_id):
        for card in deck.get("flashcards") or []:
            key = srs.card_key(card)
            if key in reviewed_keys or key in seen:
                continue
            seen.add(key)
            counts[card.get("topic_id") or deck.get("topic_id")] += 1
    return counts


def due_count(user_id: str, project_id: str, now: datetime | None = None) -> int:
    return get_db()[Collections.CARD_REVIEWS].count_documents(
        {"user_id": user_id, "project_id": project_id, "due_at": {"$lte": (now or utcnow()).replace(tzinfo=None)}}
    )


def topic_progress(
    user_id: str, project_id: str, topics: list[dict], now: datetime | None = None, learned: dict | None = None
) -> list[dict]:
    """Progress for every topic in the outline, in outline order. `learned`: the outline's {topic_id: when}."""
    now = now or utcnow()
    db = get_db()
    learned = learned or {}

    # Credit per answer: 1 right, 0 wrong; graded written answers can earn 0.5 for "partly right".
    answers: dict[str, list[float]] = defaultdict(list)
    attempts = db[Collections.QUIZ_ATTEMPTS].find(
        {"user_id": user_id, "project_id": project_id},
        {"results.topic_id": 1, "results.is_correct": 1, "results.credit": 1},
    ).sort("submitted_at", -1)
    for attempt in attempts:
        for result in attempt.get("results") or []:
            topic_id = result.get("topic_id")
            if topic_id and len(answers[topic_id]) < RECENT_ANSWERS:
                credit = result.get("credit")
                answers[topic_id].append(float(credit) if isinstance(credit, (int, float)) else float(bool(result.get("is_correct"))))

    def empty_bucket():
        return {"reviewed": 0, "due": 0, "known": 0, "new": 0, "spaced": False}

    cards: dict[str, dict] = defaultdict(empty_bucket)
    reviewed_keys: set[str] = set()
    for review in db[Collections.CARD_REVIEWS].find(
        {"user_id": user_id, "project_id": project_id},
        {"card_key": 1, "topic_id": 1, "due_at": 1, "last_rating": 1, "interval_days": 1},
    ):
        reviewed_keys.add(review.get("card_key"))
        if not review.get("topic_id"):
            continue
        bucket = cards[review["topic_id"]]
        bucket["reviewed"] += 1
        if review.get("last_rating") in ("good", "easy"):
            bucket["known"] += 1
        if (review.get("interval_days") or 0) >= SPACED_DAYS:
            bucket["spaced"] = True
        due = as_utc(review.get("due_at"))
        if due and due <= now:
            bucket["due"] += 1
    for topic_id, count in new_cards(user_id, project_id, reviewed_keys).items():
        if topic_id:
            cards[topic_id]["new"] += count

    rows = []
    for topic in topics:
        given = answers.get(topic["id"], [])
        card = {k: v for k, v in cards.get(topic["id"], empty_bucket()).items() if k != "spaced"}
        spaced = cards.get(topic["id"], empty_bucket())["spaced"]
        answered, correct = len(given), sum(given)

        parts = []
        if answered:
            parts.append((0.7, correct / answered))
        if card["reviewed"]:
            parts.append((0.3, card["known"] / card["reviewed"]))
        accuracy = sum(w * v for w, v in parts) / sum(w for w, _ in parts) if parts else None
        earned = correct + CARD_WEIGHT * card["known"]
        weight = answered + CARD_WEIGHT * card["reviewed"]
        mastery = round(100 * earned / (weight + PRIOR_ANSWERS)) if parts else None
        is_learned = topic["id"] in learned

        if mastery is None:
            status = "learning" if is_learned else "not_started"
        elif card["due"]:
            status = "review_due"
        elif mastery >= MASTERED_AT and answered >= MIN_ANSWERS_FOR_MASTERY and (spaced or not card["reviewed"]):
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
                "accuracy": round(100 * accuracy) if accuracy is not None else None,
                "status": status,
                "learned": is_learned,
                "quiz": {"answered": answered, "correct": round(correct, 1) if correct % 1 else int(correct)},
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

    # Weak = got a lot wrong (raw accuracy), not just "little evidence yet".
    def accuracy(t):
        return t.get("accuracy", t["mastery"])

    weak = sorted(
        (t for t in topics if t["status"] != "mastered" and t["mastery"] is not None and accuracy(t) < WEAK_BELOW),
        key=accuracy,
    )
    if weak:
        t = weak[0]
        return {"kind": "strengthen", "title": f"Strengthen “{t['title']}”", "detail": f"Mastery {t['mastery']}%. Re-learn it, then take a short quiz.", "topic_id": t["id"], "topic_title": t["title"]}
    # Otherwise finish topics in outline order before starting the next one.
    for t in topics:
        if t["status"] == "mastered":
            continue
        if t["mastery"] is None and not t.get("learned"):
            return {"kind": "start_topic", "title": f"Start “{t['title']}”", "detail": t.get("summary") or "Learn it, then check yourself with a quiz.", "topic_id": t["id"], "topic_title": t["title"]}
        detail = (
            f"Mastery {t['mastery']}%. A few more right answers will lock it in."
            if t["mastery"] is not None
            else "You've read the explanation. Check yourself with a short quiz."
        )
        return {"kind": "test_topic", "title": f"Test yourself on “{t['title']}”", "detail": detail, "topic_id": t["id"], "topic_title": t["title"]}
    if topics:
        return {"kind": "all_mastered", "title": "Every topic is mastered", "detail": "Keep it fresh with a mixed, hard quiz across the project."}
    return {"kind": "build_outline", "title": "Add topics to the outline", "detail": "The outline is empty. Rebuild it or add topics by hand."}


def project_overview(user_id: str, project_id: str) -> dict:
    """Everything the Overview tab and the Today panel need for one project."""
    db = get_db()
    now = utcnow()
    outline = db[Collections.TOPICS].find_one({"project_id": project_id, "user_id": user_id})
    topics = outline["topics"] if outline else []
    doc_ids = [str(d["_id"]) for d in db[Collections.DOCUMENTS].find({"project_id": project_id, "user_id": user_id}, {"_id": 1})]
    covered = set(outline.get("document_ids", [])) if outline else set()
    pending = len([d for d in doc_ids if d not in covered]) if outline else 0

    progress = topic_progress(user_id, project_id, topics, now, learned=(outline or {}).get("learned"))
    due = due_count(user_id, project_id, now)
    started = [t for t in progress if t["mastery"] is not None]
    return {
        "document_count": len(doc_ids),
        "has_outline": outline is not None,
        "pending_documents": pending,
        "topics": progress,
        "due_cards": due,
        "new_cards": sum(new_cards(user_id, project_id).values()),
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
