"""Learner statistics for the dashboard, computed from real activity."""
from __future__ import annotations

from collections import defaultdict

from flask import Blueprint, g, jsonify

from ..auth import require_auth
from ..extensions import Collections, get_db
from ..utils import serialize

bp = Blueprint("stats", __name__)


def _label(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m"
    return f"{minutes // 60}h {minutes % 60}m"


@bp.get("/me")
@require_auth
def me():
    db = get_db()
    total_documents = db[Collections.DOCUMENTS].count_documents({"user_id": g.user_id})
    attempts = list(
        db[Collections.QUIZ_ATTEMPTS]
        .find({"user_id": g.user_id}, {"results": 0})
        .sort("submitted_at", -1)
    )
    quizzes_taken = len(attempts)
    average = round(sum(a["percentage"] for a in attempts) / quizzes_taken) if quizzes_taken else 0
    study_seconds = sum(int(a.get("time_spent_seconds", 0)) for a in attempts)

    per_document: dict[str, dict] = defaultdict(lambda: {"attempts": 0, "total_pct": 0})
    for attempt in attempts:
        bucket = per_document[attempt["document_id"]]
        bucket["attempts"] += 1
        bucket["total_pct"] += attempt["percentage"]

    doc_names = {
        str(d["_id"]): d["filename"]
        for d in db[Collections.DOCUMENTS].find({"user_id": g.user_id}, {"filename": 1})
    }
    weakest = sorted(
        (
            {
                "document_id": doc_id,
                "filename": doc_names.get(doc_id, "deleted document"),
                "attempts": b["attempts"],
                "average_score": round(b["total_pct"] / b["attempts"]),
            }
            for doc_id, b in per_document.items()
            if doc_id in doc_names
        ),
        key=lambda row: row["average_score"],
    )[:3]

    return jsonify(
        {
            "success": True,
            "stats": {
                "total_documents": total_documents,
                "quizzes_taken": quizzes_taken,
                "average_score": average,
                "study_time_seconds": study_seconds,
                "study_time_label": _label(study_seconds),
                "weakest_documents": weakest,
                "recent_attempts": serialize(attempts[:5]),
            },
        }
    )
