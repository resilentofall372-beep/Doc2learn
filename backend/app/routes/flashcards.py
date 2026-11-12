from flask import Blueprint, g, jsonify

from ..auth import require_auth
from ..extensions import Collections, get_db
from .documents import owned_document

bp = Blueprint("flashcards", __name__)


@bp.get("/document/<document_id>")
@require_auth
def latest(document_id):
    owned_document(document_id, {"_id": 1})
    row = get_db()[Collections.FLASHCARDS].find_one(
        {"document_id": document_id, "user_id": g.user_id}, sort=[("created_at", -1)]
    )
    return jsonify({"success": True, "flashcards": row["flashcards"] if row else []})
