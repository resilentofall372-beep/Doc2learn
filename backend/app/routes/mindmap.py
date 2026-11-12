from flask import Blueprint, g, jsonify, request

from ..access import resolve_scope
from ..auth import require_auth
from ..extensions import Collections, get_db

bp = Blueprint("mindmap", __name__)


@bp.get("/")
@require_auth
def latest():
    """Saved concept map for ?project_id=...&document_id=... (no document_id = whole project)."""
    scope = resolve_scope(request.args)
    row = get_db()[Collections.MINDMAPS].find_one(
        {"project_id": scope["project_id"], "document_id": scope["document_id"], "user_id": g.user_id}
    )
    return jsonify({"success": True, "mindmap": row["mindmap"] if row else None})
