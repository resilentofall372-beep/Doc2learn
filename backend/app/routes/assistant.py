"""Grounded tutor for a project: chat with history, explanations, practice, summaries, study plans.

The chat always searches the whole project. The other tools take an optional
`document_id` to focus on one file.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..access import owned_project, resolve_scope
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation
from ..services.progress import topic_progress
from ..utils import clamp, clean_str, to_object_id

bp = Blueprint("assistant", __name__)

MAX_HISTORY = 100


def _scope_args(scope: dict) -> dict:
    return {"project_id": scope["project_id"], "document_id": scope["document_id"]}


def _session(project_id: str) -> dict:
    db = get_db()
    session = db[Collections.CHAT_SESSIONS].find_one(
        {"project_id": project_id, "user_id": g.user_id}, sort=[("created_at", -1)]
    )
    if session:
        return session
    session = {
        "project_id": project_id,
        "user_id": g.user_id,
        "messages": [],
        "created_at": datetime.now(timezone.utc),
    }
    session["_id"] = db[Collections.CHAT_SESSIONS].insert_one(session).inserted_id
    return session


def _append(session_id, role: str, content: str, metadata: dict | None = None) -> dict:
    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc),
        "metadata": metadata or {},
    }
    get_db()[Collections.CHAT_SESSIONS].update_one(
        {"_id": session_id, "user_id": g.user_id},
        {"$push": {"messages": {"$each": [message], "$slice": -MAX_HISTORY}}},
    )
    return message


def _format(message: dict) -> dict:
    ts = message.get("timestamp")
    return {
        "role": message["role"],
        "content": message["content"],
        "timestamp": ts.isoformat() if isinstance(ts, datetime) else ts,
        "metadata": message.get("metadata", {}),
    }


@bp.post("/chat")
@require_auth
def chat():
    data = request.get_json(silent=True) or {}
    question = clean_str(data.get("question"), 2000)
    if not question:
        raise ApiError("question is required")
    project = owned_project(data.get("project_id"), {"_id": 1})
    project_id = str(project["_id"])

    session = _session(project_id)
    history = [{"role": m["role"], "content": m["content"]} for m in session.get("messages", [])]
    result = generation.chat({"project_id": project_id, "document_id": None}, question, history)

    _append(session["_id"], "user", question)
    _append(
        session["_id"],
        "assistant",
        result["answer"],
        {"sources": result["sources"], "confidence": result["confidence"], "legend": result["legend"]},
    )
    return jsonify({"success": True, "session_id": str(session["_id"]), **result})


@bp.get("/chat/history/<project_id>")
@require_auth
def history(project_id):
    owned_project(project_id, {"_id": 1})
    session = get_db()[Collections.CHAT_SESSIONS].find_one(
        {"project_id": project_id, "user_id": g.user_id}, sort=[("created_at", -1)]
    )
    if not session:
        return jsonify({"success": True, "messages": [], "session_id": None})
    return jsonify(
        {
            "success": True,
            "session_id": str(session["_id"]),
            "messages": [_format(m) for m in session.get("messages", [])],
        }
    )


@bp.post("/chat/clear")
@require_auth
def clear():
    data = request.get_json(silent=True) or {}
    session_id = to_object_id(data.get("session_id"), "session id")
    result = get_db()[Collections.CHAT_SESSIONS].update_one(
        {"_id": session_id, "user_id": g.user_id}, {"$set": {"messages": []}}
    )
    if result.matched_count == 0:
        raise ApiError("Chat session not found", 404)
    return jsonify({"success": True})


@bp.post("/summarize")
@require_auth
def summarize():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    summary_type = "detailed" if data.get("summary_type") == "detailed" else "brief"
    return jsonify({"success": True, **generation.summarize(_scope_args(scope), summary_type)})


@bp.post("/explain")
@require_auth
def explain():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    concept = clean_str(data.get("concept"), 200)
    if not concept:
        raise ApiError("concept is required")
    return jsonify({"success": True, **generation.explain(_scope_args(scope), concept)})


@bp.post("/practice")
@require_auth
def practice():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    topic = clean_str(data.get("topic"), 200) or "general"
    count = clamp(data.get("num_problems"), 1, 10, 5)
    return jsonify({"success": True, **generation.practice_problems(_scope_args(scope), topic, count)})


@bp.post("/study-plan")
@require_auth
def study_plan():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    days = clamp(data.get("days"), 1, 30, 7)
    raw_areas = data.get("weak_areas") if isinstance(data.get("weak_areas"), list) else []
    weak_areas = [clean_str(a, 80) for a in raw_areas if clean_str(a, 80)][:10]

    attempts_filter = {"project_id": scope["project_id"], "user_id": g.user_id}
    if scope["document_id"]:
        attempts_filter["document_id"] = scope["document_id"]
    attempts = list(get_db()[Collections.QUIZ_ATTEMPTS].find(attempts_filter, {"percentage": 1}))
    performance = None
    if attempts:
        performance = {
            "attempts": len(attempts),
            "average_score": round(sum(a["percentage"] for a in attempts) / len(attempts)),
        }

    # Whole-project plans follow the outline and the learner's real progress, and are saved.
    progress = None
    if not scope["document_id"]:
        outline = get_db()[Collections.TOPICS].find_one({"project_id": scope["project_id"], "user_id": g.user_id})
        if outline and outline.get("topics"):
            progress = topic_progress(g.user_id, scope["project_id"], outline["topics"])
            if not weak_areas:
                weak_areas = [t["title"] for t in weakest_topics(progress)]

    result = generation.study_plan(_scope_args(scope), weak_areas, days, performance, progress)
    if not result["plan"]:
        raise ApiError("The model did not produce a usable plan. Try again.", 502)
    if not scope["document_id"]:
        now = datetime.now(timezone.utc)
        get_db()[Collections.STUDY_PLANS].update_one(
            {"project_id": scope["project_id"], "user_id": g.user_id},
            {"$set": {"plan": result["plan"], "duration_days": days, "weak_areas": weak_areas, "created_at": now, "done": []}},
            upsert=True,
        )
        result = {**result, **plan_payload({"plan": result["plan"], "duration_days": days, "weak_areas": weak_areas, "created_at": now, "done": []})}
    return jsonify({"success": True, **result})


def weakest_topics(progress: list[dict], limit: int = 4) -> list[dict]:
    """Topics that most need time: started-but-weak first (lowest mastery), then those with cards due."""
    started = sorted((t for t in progress if t["mastery"] is not None and t["status"] != "mastered"), key=lambda t: t["mastery"])
    due = [t for t in progress if t["cards"]["due"] and t not in started]
    return (started + due)[:limit]


def plan_payload(row: dict | None) -> dict:
    """A saved plan plus which day of it is today (1-based; past the end means it's finished)."""
    if not row:
        return {"saved_plan": None}
    created = row["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    today = (datetime.now(timezone.utc).date() - created.date()).days + 1
    return {
        "saved_plan": {
            "plan": row["plan"],
            "duration_days": row.get("duration_days", len(row["plan"])),
            "weak_areas": row.get("weak_areas", []),
            "created_at": created.isoformat(),
            "today": today,
            "finished": today > len(row["plan"]),
            "done": row.get("done", []),
        }
    }


def saved_plan(user_id: str, project_id: str) -> dict:
    return plan_payload(get_db()[Collections.STUDY_PLANS].find_one({"project_id": project_id, "user_id": user_id}))


@bp.get("/study-plan/<project_id>")
@require_auth
def get_study_plan(project_id):
    owned_project(project_id, {"_id": 1})
    return jsonify({"success": True, **saved_plan(g.user_id, project_id)})


@bp.post("/study-plan/<project_id>/done")
@require_auth
def mark_plan_day(project_id):
    """Tick a day of the saved plan done (or undo it). Body: {day, done}."""
    owned_project(project_id, {"_id": 1})
    data = request.get_json(silent=True) or {}
    day = clamp(data.get("day"), 1, 60, None)
    if day is None:
        raise ApiError("day is required")
    op = "$addToSet" if data.get("done", True) else "$pull"
    result = get_db()[Collections.STUDY_PLANS].update_one({"project_id": project_id, "user_id": g.user_id}, {op: {"done": day}})
    if result.matched_count == 0:
        raise ApiError("No saved plan for this project", 404)
    return jsonify({"success": True, **saved_plan(g.user_id, project_id)})
