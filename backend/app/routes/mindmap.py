from flask import Blueprint, g, jsonify

from ..auth import require_auth
from ..extensions import Collections, get_db
from .documents import owned_document

bp = Blueprint("mindmap", __name__)


@bp.get("/document/<document_id>")
@require_auth
def latest(document_id):
    owned_document(document_id, {"_id": 1})
    row = get_db()[Collections.MINDMAPS].find_one({"document_id": document_id, "user_id": g.user_id})
    return jsonify({"success": True, "mindmap": row["mindmap"] if row else None})
