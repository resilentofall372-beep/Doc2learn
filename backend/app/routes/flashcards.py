from flask import Blueprint, g, jsonify, request

from ..access import resolve_scope
from ..auth import require_auth
from ..extensions import Collections, get_db

bp = Blueprint("flashcards", __name__)


@bp.get("/")
@require_auth
def latest():
    """Latest deck for ?project_id=...&document_id=... (no document_id = whole project)."""
    scope = resolve_scope(request.args)
    row = get_db()[Collections.FLASHCARDS].find_one(
        {"project_id": scope["project_id"], "document_id": scope["document_id"], "user_id": g.user_id},
        sort=[("created_at", -1)],
    )
    return jsonify({"success": True, "flashcards": row["flashcards"] if row else []})
