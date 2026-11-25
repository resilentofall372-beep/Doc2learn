"""Ownership checks shared by every route.

A user can only ever see their own projects and documents. Anything that
belongs to someone else is reported as "not found" (404), so other users can't
even learn that it exists.
"""
from __future__ import annotations

from flask import g

from .errors import ApiError
from .extensions import Collections, get_db
from .utils import to_object_id


def _with_owner(projection: dict | None) -> dict | None:
    # Inclusion projections must keep the owner field for the check below.
    if projection and any(projection.values()):
        return {**projection, "user_id": 1}
    return projection


def owned(collection: str, item_id: str | None, label: str, projection: dict | None = None) -> dict:
    """The user's own `label` (e.g. "project") with this id, else 400/404."""
    if not item_id:
        raise ApiError(f"{label}_id is required")
    item = get_db()[collection].find_one(
        {"_id": to_object_id(item_id, f"{label} id"), "user_id": g.user_id}, _with_owner(projection)
    )
    if not item:
        raise ApiError(f"{label.capitalize()} not found", 404)
    return item


def owned_project(project_id: str | None, projection: dict | None = None) -> dict:
    return owned(Collections.PROJECTS, project_id, "project", projection)


def owned_project_id(project_id: str | None) -> str:
    """Check the project is the user's and return its id as a string."""
    return str(owned_project(project_id, {"_id": 1})["_id"])


def owned_document(document_id: str | None, projection: dict | None = None) -> dict:
    return owned(Collections.DOCUMENTS, document_id, "document", projection)


def scope_ids(scope: dict) -> dict:
    """Just the ids of a resolved scope (what generation and stored rows need)."""
    return {"project_id": scope["project_id"], "document_id": scope["document_id"]}


def resolve_scope(data: dict) -> dict:
    """Validate `project_id` (+ optional `document_id`) from a request body or query string.

    Returns {"project_id", "document_id" (or None), "project"}; the document,
    when given, must belong to that project.
    """
    project = owned_project(data.get("project_id"), {"name": 1})
    project_id = str(project["_id"])
    document_id = data.get("document_id") or None
    if document_id:
        doc = owned_document(document_id, {"project_id": 1})
        if doc.get("project_id") != project_id:
            raise ApiError("Document not found in this project", 404)
    return {"project_id": project_id, "document_id": document_id, "project": project}


def touch_project(project_id: str) -> None:
    """Mark a project as recently changed (sorts it to the top of the list)."""
    from datetime import datetime, timezone

    get_db()[Collections.PROJECTS].update_one(
        {"_id": to_object_id(project_id, "project id")}, {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )
