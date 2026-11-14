"""Flashcard decks and spaced-repetition reviews.

A review row (`card_reviews`) is created the first time a learner rates a card and
holds a copy of the card, so due cards can be shown even if the deck that held them
was replaced by a fresh one.
"""
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..access import owned_project, resolve_scope
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import srs
from ..utils import clamp, clean_str, serialize

bp = Blueprint("flashcards", __name__)


def _utcnow() -> datetime:
    # Stored naive (UTC), the way PyMongo hands datetimes back.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _with_ids(cards: list[dict]) -> list[dict]:
    return [{**card, "id": srs.card_key(card)} for card in cards]


@bp.get("/")
@require_auth
def latest():
    """Latest deck for ?project_id=...&document_id=...&topic_id=...

    No document_id = whole project; no topic_id = the general deck (not a single topic's).
    `generated_at` lets the page notice documents added after the deck was made, and
    `schedule` gives each reviewed card's next due date.
    """
    scope = resolve_scope(request.args)
    row = get_db()[Collections.FLASHCARDS].find_one(
        {
            "project_id": scope["project_id"],
            "document_id": scope["document_id"],
            "topic_id": request.args.get("topic_id") or None,  # also matches decks saved before topics existed
            "user_id": g.user_id,
        },
        sort=[("created_at", -1)],
    )
    cards = _with_ids(row["flashcards"]) if row else []
    schedule = {}
    if cards:
        for review in get_db()[Collections.CARD_REVIEWS].find(
            {"user_id": g.user_id, "project_id": scope["project_id"], "card_key": {"$in": [c["id"] for c in cards]}},
            {"card_key": 1, "due_at": 1, "last_rating": 1, "interval_days": 1},
        ):
            schedule[review["card_key"]] = serialize(
                {"due_at": review.get("due_at"), "last_rating": review.get("last_rating"), "interval_days": review.get("interval_days")}
            )
    return jsonify(
        {
            "success": True,
            "flashcards": cards,
            "schedule": schedule,
            "generated_at": serialize(row.get("created_at")) if row else None,
            "document_id": scope["document_id"],
        }
    )


@bp.post("/review")
@require_auth
def review():
    """Rate one card. Body: {project_id, rating, card: {id, front, back, topic_id?, source_document?, source_page?}, document_id?}"""
    data = request.get_json(silent=True) or {}
    project = owned_project(data.get("project_id"), {"_id": 1})
    project_id = str(project["_id"])
    rating = data.get("rating")
    if rating not in srs.RATINGS:
        raise ApiError(f"rating must be one of {', '.join(srs.RATINGS)}")
    card = data.get("card") if isinstance(data.get("card"), dict) else {}
    front, back = clean_str(card.get("front"), 1000), clean_str(card.get("back"), 2000)
    if not front or not back:
        raise ApiError("card needs a front and a back")
    key = srs.card_key({"id": clean_str(card.get("id"), 64), "front": front, "back": back})

    db = get_db()
    topic_id = card.get("topic_id") if isinstance(card.get("topic_id"), str) else None
    if topic_id:
        outline = db[Collections.TOPICS].find_one({"project_id": project_id, "user_id": g.user_id}, {"topics.id": 1}) or {}
        if topic_id not in {t["id"] for t in outline.get("topics", [])}:
            topic_id = None  # unknown topics aren't stored
    source = card.get("source_document") if isinstance(card.get("source_document"), dict) else None

    existing = db[Collections.CARD_REVIEWS].find_one({"user_id": g.user_id, "project_id": project_id, "card_key": key})
    now = _utcnow()
    state = srs.schedule(existing, rating, now)
    db[Collections.CARD_REVIEWS].update_one(
        {"user_id": g.user_id, "project_id": project_id, "card_key": key},
        {
            "$set": {
                **state,
                "front": front,
                "back": back,
                "topic_id": topic_id,
                # The card's document, so deleting that document also drops its reviews.
                "document_id": clean_str(data.get("document_id"), 64) or clean_str((source or {}).get("document_id"), 64) or None,
                "source_document": {"document_id": clean_str(source.get("document_id"), 64), "filename": clean_str(source.get("filename"), 200)} if source else None,
                "source_page": card.get("source_page") if isinstance(card.get("source_page"), int) else None,
            },
            "$inc": {"review_count": 1},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return jsonify({"success": True, "card_id": key, **serialize({k: state[k] for k in ("due_at", "interval_days", "last_rating")})})


@bp.get("/due")
@require_auth
def due():
    """Cards due now in ?project_id=... (optionally &topic_id=...), most overdue first."""
    project = owned_project(request.args.get("project_id"), {"_id": 1})
    query = {"user_id": g.user_id, "project_id": str(project["_id"]), "due_at": {"$lte": _utcnow()}}
    if request.args.get("topic_id"):
        query["topic_id"] = request.args["topic_id"]
    limit = clamp(request.args.get("limit"), 1, 200, 100)
    total = get_db()[Collections.CARD_REVIEWS].count_documents(query)
    rows = list(get_db()[Collections.CARD_REVIEWS].find(query).sort("due_at", 1).limit(limit))
    cards = [
        {
            "id": r["card_key"],
            "front": r["front"],
            "back": r["back"],
            "topic_id": r.get("topic_id"),
            "source_document": r.get("source_document"),
            "source_page": r.get("source_page"),
            "document_id": r.get("document_id"),
            "last_rating": r.get("last_rating"),
            "interval_days": r.get("interval_days"),
        }
        for r in rows
    ]
    return jsonify({"success": True, "cards": cards, "count": len(cards), "total": total})
