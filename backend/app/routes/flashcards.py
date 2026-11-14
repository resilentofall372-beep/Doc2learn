from flask import Blueprint, g, jsonify, request

from ..access import resolve_scope
from ..auth import require_auth
from ..extensions import Collections, get_db
from ..utils import serialize

bp = Blueprint("flashcards", __name__)


@bp.get("/")
@require_auth
def latest():
    """Latest deck for ?project_id=...&document_id=...&topic_id=...

    No document_id = whole project; no topic_id = the general deck (not a single topic's).
    `generated_at` lets the page notice documents added after the deck was made.
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
    return jsonify(
        {
            "success": True,
            "flashcards": row["flashcards"] if row else [],
            "generated_at": serialize(row.get("created_at")) if row else None,
        }
    )
