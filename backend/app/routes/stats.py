"""Learner statistics computed from real activity: for one project, or across all of them."""
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


def compute_stats(user_id: str, project_id: str | None = None) -> dict:
    db = get_db()
    scope = {"user_id": user_id}
    if project_id:
        scope["project_id"] = project_id

    total_documents = db[Collections.DOCUMENTS].count_documents(scope)
    # Graded written answers count towards topic mastery, not as quizzes taken.
    attempts = list(db[Collections.QUIZ_ATTEMPTS].find({**scope, "kind": {"$ne": "written"}}, {"results": 0}).sort("submitted_at", -1))
    quizzes_taken = len(attempts)
    average = round(sum(a["percentage"] for a in attempts) / quizzes_taken) if quizzes_taken else 0
    study_seconds = sum(int(a.get("time_spent_seconds", 0)) for a in attempts)

    # Weakest documents: only attempts on a single document say which file is weak.
    per_document: dict[str, dict] = defaultdict(lambda: {"attempts": 0, "total_pct": 0})
    for attempt in attempts:
        if attempt.get("document_id"):
            bucket = per_document[attempt["document_id"]]
            bucket["attempts"] += 1
            bucket["total_pct"] += attempt["percentage"]

    names = {str(d["_id"]): d.get("filename", "") for d in db[Collections.DOCUMENTS].find(scope, {"filename": 1})}
    weakest = sorted(
        (
            {
                "document_id": doc_id,
                "filename": names[doc_id],
                "attempts": b["attempts"],
                "average_score": round(b["total_pct"] / b["attempts"]),
            }
            for doc_id, b in per_document.items()
            if doc_id in names
        ),
        key=lambda row: row["average_score"],
    )[:3]

    return {
        "total_documents": total_documents,
        "quizzes_taken": quizzes_taken,
        "average_score": average,
        "study_time_seconds": study_seconds,
        "study_time_label": _label(study_seconds),
        "weakest_documents": weakest,
        "recent_attempts": serialize(attempts[:5]),
    }


@bp.get("/today")
@require_auth
def today():
    """What to do today across projects: cards due, each project's next step and weakest topic.

    Projects are ordered by when they were last opened (at most 12).
    """
    from ..services.progress import project_overview
    from .assistant import saved_plan

    db = get_db()
    projects = list(
        db[Collections.PROJECTS].find({"user_id": g.user_id}, {"name": 1, "color": 1, "last_opened_at": 1, "updated_at": 1})
        .sort([("last_opened_at", -1), ("updated_at", -1)])
        .limit(12)
    )
    rows = []
    for project in projects:
        project_id = str(project["_id"])
        overview = project_overview(g.user_id, project_id)
        started = [t for t in overview["topics"] if t["mastery"] is not None and t["status"] != "mastered"]
        weakest = min(started, key=lambda t: t["mastery"]) if started else None
        plan = saved_plan(g.user_id, project_id)["saved_plan"]
        plan_today = None
        if plan and not plan["finished"]:
            day = plan["plan"][plan["today"] - 1]
            plan_today = {"day": day["day"], "topic": day["topic"], "activities": day["activities"], "done": plan["today"] in plan["done"]}
        rows.append(
            {
                "_id": project_id,
                "name": project.get("name", ""),
                "color": project.get("color", "c0"),
                "last_opened_at": serialize(project.get("last_opened_at")),
                "due_cards": overview["due_cards"],
                "new_cards": overview["new_cards"],
                "next_step": overview["next_step"],
                "summary": overview["summary"],
                "weakest_topic": {"id": weakest["id"], "title": weakest["title"], "mastery": weakest["mastery"]} if weakest else None,
                "plan_today": plan_today,
            }
        )
    return jsonify({"success": True, "projects": rows, "due_cards": sum(r["due_cards"] for r in rows), "new_cards": sum(r["new_cards"] for r in rows)})


@bp.get("/me")
@require_auth
def me():
    """Totals across every project the user owns."""
    stats = compute_stats(g.user_id)
    stats["total_projects"] = get_db()[Collections.PROJECTS].count_documents({"user_id": g.user_id})
    return jsonify({"success": True, "stats": stats})
