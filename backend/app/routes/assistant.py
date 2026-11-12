"""Grounded tutor: chat with history, explanations, practice, summaries, study plans."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation
from ..utils import clamp, clean_str, to_object_id
from .documents import owned_document

bp = Blueprint("assistant", __name__)

MAX_HISTORY = 100


def _session(document_id: str) -> dict:
    db = get_db()
    session = db[Collections.CHAT_SESSIONS].find_one({"document_id": document_id, "user_id": g.user_id})
    if session:
        return session
    session = {
        "document_id": document_id,
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
        {"_id": session_id},
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
    document_id = data.get("document_id")
    question = clean_str(data.get("question"), 2000)
    if not question:
        raise ApiError("question is required")
    owned_document(document_id, {"_id": 1})

    session = _session(document_id)
    history = [{"role": m["role"], "content": m["content"]} for m in session.get("messages", [])]
    result = generation.chat(document_id, question, history)

    _append(session["_id"], "user", question)
    _append(
        session["_id"],
        "assistant",
        result["answer"],
        {"sources": result["sources"], "confidence": result["confidence"]},
    )
    return jsonify({"success": True, "session_id": str(session["_id"]), **result})


@bp.get("/chat/history/<document_id>")
@bp.get("/chat/history/<document_id>/<_legacy_user_id>")
@require_auth
def history(document_id, _legacy_user_id=None):
    owned_document(document_id, {"_id": 1})
    session = get_db()[Collections.CHAT_SESSIONS].find_one({"document_id": document_id, "user_id": g.user_id})
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
    owned_document(data.get("document_id"), {"_id": 1})
    summary_type = "detailed" if data.get("summary_type") == "detailed" else "brief"
    return jsonify({"success": True, **generation.summarize(data["document_id"], summary_type)})


@bp.post("/explain")
@require_auth
def explain():
    data = request.get_json(silent=True) or {}
    owned_document(data.get("document_id"), {"_id": 1})
    concept = clean_str(data.get("concept"), 200)
    if not concept:
        raise ApiError("concept is required")
    return jsonify({"success": True, **generation.explain(data["document_id"], concept)})


@bp.post("/practice")
@require_auth
def practice():
    data = request.get_json(silent=True) or {}
    owned_document(data.get("document_id"), {"_id": 1})
    topic = clean_str(data.get("topic"), 200) or "general"
    count = clamp(data.get("num_problems"), 1, 10, 5)
    return jsonify({"success": True, **generation.practice_problems(data["document_id"], topic, count)})


@bp.post("/study-plan")
@require_auth
def study_plan():
    data = request.get_json(silent=True) or {}
    document_id = data.get("document_id")
    owned_document(document_id, {"_id": 1})
    days = clamp(data.get("days"), 1, 30, 7)
    raw_areas = data.get("weak_areas") if isinstance(data.get("weak_areas"), list) else []
    weak_areas = [clean_str(a, 80) for a in raw_areas if clean_str(a, 80)][:10]

    attempts = list(
        get_db()[Collections.QUIZ_ATTEMPTS].find(
            {"document_id": document_id, "user_id": g.user_id}, {"percentage": 1}
        )
    )
    performance = None
    if attempts:
        performance = {
            "attempts": len(attempts),
            "average_score": round(sum(a["percentage"] for a in attempts) / len(attempts)),
        }
    return jsonify({"success": True, **generation.study_plan(document_id, weak_areas, days, performance)})
