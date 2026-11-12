"""Projects: a user's study spaces. Each one holds documents and everything generated from them.

Every query filters on the signed-in user (`g.user_id`); another user's
project is reported as not found.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..access import owned_project
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import PROJECT_CONTENT, Collections, get_db
from ..utils import clean_str, serialize
from .stats import compute_stats

bp = Blueprint("projects", __name__)

COLORS = {f"c{i}" for i in range(8)}  # matches the avatar palette in the frontend


def _payload(project: dict, document_count: int = 0) -> dict:
    return serialize(
        {
            "_id": project["_id"],
            "name": project.get("name", ""),
            "description": project.get("description", ""),
            "color": project.get("color", "c0"),
            "created_at": project.get("created_at"),
            "updated_at": project.get("updated_at"),
            "last_opened_at": project.get("last_opened_at"),
            "document_count": document_count,
        }
    )


def _fields(data: dict, partial: bool) -> dict:
    fields = {}
    if not partial or "name" in data:
        name = clean_str(data.get("name"), 60)
        if not name:
            raise ApiError("Give the project a name")
        fields["name"] = name
    if not partial or "description" in data:
        fields["description"] = clean_str(data.get("description"), 200)
    if not partial or "color" in data:
        color = data.get("color")
        fields["color"] = color if color in COLORS else "c0"
    return fields


@bp.get("/")
@require_auth
def list_projects():
    db = get_db()
    counts = {
        row["_id"]: row["n"]
        for row in db[Collections.DOCUMENTS].aggregate(
            [{"$match": {"user_id": g.user_id}}, {"$group": {"_id": "$project_id", "n": {"$sum": 1}}}]
        )
    }
    projects = db[Collections.PROJECTS].find({"user_id": g.user_id}).sort("updated_at", -1)
    return jsonify({"success": True, "projects": [_payload(p, counts.get(str(p["_id"]), 0)) for p in projects]})


@bp.post("/")
@require_auth
def create_project():
    data = request.get_json(silent=True) or {}
    now = datetime.now(timezone.utc)
    project = {
        "user_id": g.user_id,
        **_fields(data, partial=False),
        "created_at": now,
        "updated_at": now,
        "last_opened_at": now,
    }
    project["_id"] = get_db()[Collections.PROJECTS].insert_one(project).inserted_id
    return jsonify({"success": True, "project": _payload(project)}), 201


@bp.get("/<project_id>")
@require_auth
def get_project(project_id):
    """The project plus its documents (no text), and remember it was opened."""
    from .documents import summary as document_summary

    project = owned_project(project_id)
    db = get_db()
    now = datetime.now(timezone.utc)
    db[Collections.PROJECTS].update_one({"_id": project["_id"]}, {"$set": {"last_opened_at": now}})
    project["last_opened_at"] = now
    docs = list(
        db[Collections.DOCUMENTS]
        .find({"project_id": str(project["_id"]), "user_id": g.user_id}, {"extracted_text": 0, "pages": 0})
        .sort("uploaded_on", 1)
    )
    return jsonify(
        {
            "success": True,
            "project": _payload(project, len(docs)),
            "documents": [document_summary(d, number=i) for i, d in enumerate(docs, start=1)],
        }
    )


@bp.patch("/<project_id>")
@require_auth
def update_project(project_id):
    project = owned_project(project_id)
    fields = _fields(request.get_json(silent=True) or {}, partial=True)
    if fields:
        fields["updated_at"] = datetime.now(timezone.utc)
        get_db()[Collections.PROJECTS].update_one({"_id": project["_id"]}, {"$set": fields})
        project.update(fields)
    count = get_db()[Collections.DOCUMENTS].count_documents({"project_id": project_id, "user_id": g.user_id})
    return jsonify({"success": True, "project": _payload(project, count)})


@bp.delete("/<project_id>")
@require_auth
def delete_project(project_id):
    """Delete the project and everything inside it."""
    project = owned_project(project_id, {"_id": 1})
    db = get_db()
    for name in PROJECT_CONTENT:
        db[name].delete_many({"project_id": project_id, "user_id": g.user_id} if name != Collections.CHUNKS else {"project_id": project_id})
    # Close any lobbies still waiting on this project's questions.
    db[Collections.ROOMS].update_many(
        {"project_id": project_id, "host_id": g.user_id, "quiz_state": "lobby"},
        {"$set": {"is_active": False, "quiz_state": "closed"}},
    )
    db[Collections.PROJECTS].delete_one({"_id": project["_id"]})
    return jsonify({"success": True, "deleted": project_id})


@bp.get("/<project_id>/stats")
@require_auth
def project_stats(project_id):
    owned_project(project_id, {"_id": 1})
    return jsonify({"success": True, "stats": compute_stats(g.user_id, project_id)})
