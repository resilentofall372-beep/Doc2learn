"""Grounded tutor for a project: chat with history, explanations, practice, summaries, study plans.

The chat always searches the whole project. The other tools take an optional
`document_id` to focus on one file.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..access import owned_project, owned_project_id, resolve_scope, scope_ids
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation
from ..services.progress import topic_progress
from ..utils import as_utc, clamp, clean_str, to_object_id
from .topics import find_topic, topic_list

bp = Blueprint("assistant", __name__)

MAX_HISTORY = 100



def _latest_session(project_id: str) -> dict | None:
    return get_db()[Collections.CHAT_SESSIONS].find_one(
        {"project_id": project_id, "user_id": g.user_id}, sort=[("created_at", -1)]
    )


def _session(project_id: str) -> dict:
    session = _latest_session(project_id)
    if session:
        return session
    session = {
        "project_id": project_id,
        "user_id": g.user_id,
        "messages": [],
        "created_at": datetime.now(timezone.utc),
    }
    session["_id"] = get_db()[Collections.CHAT_SESSIONS].insert_one(session).inserted_id
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
    project_id = owned_project_id(data.get("project_id"))

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
    session = _latest_session(project_id)
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
    return jsonify({"success": True, **generation.summarize(scope_ids(scope), summary_type)})


@bp.post("/explain")
@require_auth
def explain():
    """Explain a concept. With `topic_id`, the explanation is saved to that outline topic and
    the topic counts as learned (the "Learn" step on Overview)."""
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    concept = clean_str(data.get("concept"), 200)
    if not concept:
        raise ApiError("concept is required")
    topic = find_topic(scope["project_id"], g.user_id, clean_str(data.get("topic_id"), 64) or None)
    result = generation.explain(scope_ids(scope), concept)
    if topic:
        now = datetime.now(timezone.utc)
        saved = {**{k: result[k] for k in ("concept", "explanation", "sources", "legend")}, "topic_id": topic["id"], "created_at": now}
        get_db()[Collections.TOPICS].update_one(
            {"project_id": scope["project_id"], "user_id": g.user_id},
            {"$set": {f"learned.{topic['id']}": now, f"explanations.{topic['id']}": saved}},
        )
        result = {**result, "topic_id": topic["id"]}
    return jsonify({"success": True, **result})


@bp.get("/explanations")
@require_auth
def explanations():
    """Saved topic explanations for ?project_id=..., newest first (one per topic)."""
    project_id = owned_project_id(request.args.get("project_id"))
    outline = get_db()[Collections.TOPICS].find_one({"project_id": project_id, "user_id": g.user_id}, {"explanations": 1, "topics": 1})
    titles = {t["id"]: t["title"] for t in (outline or {}).get("topics", [])}
    rows = [
        {**row, "topic_title": titles[topic_id], "created_at": as_utc(row["created_at"]).isoformat()}
        for topic_id, row in ((outline or {}).get("explanations") or {}).items()
        if topic_id in titles  # topics removed from the outline drop out
    ]
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return jsonify({"success": True, "explanations": rows})


@bp.post("/practice")
@require_auth
def practice():
    """Open written problems. With `topic_id` (an outline topic) they are about that topic, and
    graded answers to them count towards its mastery."""
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    outline_topic = find_topic(scope["project_id"], g.user_id, clean_str(data.get("topic_id"), 64) or None)
    topic = outline_topic["title"] if outline_topic else clean_str(data.get("topic"), 200) or "general"
    count = clamp(data.get("num_problems"), 1, 10, 5)
    result = generation.practice_problems(scope_ids(scope), topic, count)
    return jsonify({"success": True, **result, "topic_id": outline_topic["id"] if outline_topic else None})


@bp.post("/practice/grade")
@require_auth
def grade_practice():
    """Grade one written answer against the documents.

    Body: {project_id, document_id?, question, model_answer, answer, topic_id?, attempt_id?}.
    The result is saved as a "written" attempt: with a topic it counts towards that topic's
    mastery (right = 1, partly right = 0.5, wrong = 0), but not as a quiz taken. Checking a
    rewritten answer again passes the earlier `attempt_id`, which is replaced (not counted twice).
    """
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    question = clean_str(data.get("question"), 1000)
    answer = clean_str(data.get("answer"), 4000)
    model_answer = clean_str(data.get("model_answer"), 4000)
    if not question:
        raise ApiError("question is required")
    if not answer:
        raise ApiError("Write an answer first")
    topic = find_topic(scope["project_id"], g.user_id, clean_str(data.get("topic_id"), 64) or None)

    graded = generation.grade_answer(scope_ids(scope), question, model_answer, answer)
    credit = {"correct": 1.0, "partial": 0.5}.get(graded["verdict"], 0.0)
    row = {
        **scope_ids(scope),
        "user_id": g.user_id,
        "kind": "written",
        "score": credit,
        "total": 1,
        "percentage": round(100 * credit),
        "topic_id": topic["id"] if topic else None,
        "results": [
            {
                "question": question,
                "user_answer": answer,
                "is_correct": graded["verdict"] == "correct",
                "credit": credit,
                "feedback": graded["feedback"],
                "topic_id": topic["id"] if topic else None,
            }
        ],
        "submitted_at": datetime.now(timezone.utc),
    }
    attempts = get_db()[Collections.QUIZ_ATTEMPTS]
    previous = None
    if data.get("attempt_id"):
        previous = attempts.find_one(
            {"_id": to_object_id(data.get("attempt_id"), "attempt id"), "user_id": g.user_id, "kind": "written"}, {"_id": 1}
        )
    if previous:
        attempts.replace_one({"_id": previous["_id"]}, row)
        attempt_id = previous["_id"]
    else:
        attempt_id = attempts.insert_one(row).inserted_id
    return jsonify({"success": True, **graded, "credit": credit, "counted": bool(topic), "attempt_id": str(attempt_id)})


@bp.post("/study-plan")
@require_auth
def study_plan():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    days = clamp(data.get("days"), 1, 30, 7)
    raw_areas = data.get("weak_areas") if isinstance(data.get("weak_areas"), list) else []
    weak_areas = [clean_str(a, 80) for a in raw_areas if clean_str(a, 80)][:10]

    attempts_filter = {"project_id": scope["project_id"], "user_id": g.user_id, "kind": {"$ne": "written"}}
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
        topics = topic_list(scope["project_id"], g.user_id)
        if topics:
            progress = topic_progress(g.user_id, scope["project_id"], topics)
            if not weak_areas:
                weak_areas = [t["title"] for t in weakest_topics(progress)]

    result = generation.study_plan(scope_ids(scope), weak_areas, days, performance, progress)
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
    created = as_utc(row["created_at"])
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
