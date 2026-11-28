"""Quiz attempts: server-side grading and history."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..access import owned, owned_project
from ..auth import require_auth
from ..extensions import Collections, get_db
from ..utils import clamp, serialize

bp = Blueprint("quiz", __name__)


@bp.post("/submit")
@require_auth
def submit():
    data = request.get_json(silent=True) or {}
    quiz = owned(Collections.QUIZZES, data.get("quiz_id"), "quiz")
    answers = data.get("answers") if isinstance(data.get("answers"), dict) else {}
    time_spent = clamp(data.get("time_spent_seconds"), 0, 24 * 3600, 0)

    results, score = [], 0
    for index, question in enumerate(quiz["questions"]):
        given = str(answers.get(str(index), "") or "").strip().upper()[:1]
        correct = given == question["answer"]
        score += int(correct)
        results.append(
            {
                "question_index": index,
                "question": question["question"],
                "options": question["options"],
                "user_answer": given or None,
                "correct_answer": question["answer"],
                "is_correct": correct,
                "explanation": question.get("explanation", ""),
                "source_document": question.get("source_document"),
                "source_page": question.get("source_page"),
                "source_section": question.get("source_section"),
                "topic_id": question.get("topic_id"),
            }
        )
    total = len(quiz["questions"])
    percentage = round(100 * score / total) if total else 0

    attempt = {
        "quiz_id": str(quiz["_id"]),
        "project_id": quiz.get("project_id"),
        "document_id": quiz.get("document_id"),
        "user_id": g.user_id,
        "score": score,
        "total": total,
        "percentage": percentage,
        "difficulty": quiz.get("difficulty"),
        "topic_id": quiz.get("topic_id"),
        "focus": quiz.get("focus"),
        "time_spent_seconds": time_spent,
        "results": results,
        "submitted_at": datetime.now(timezone.utc),
    }
    inserted = get_db()[Collections.QUIZ_ATTEMPTS].insert_one(attempt)
    get_db()[Collections.QUIZZES].update_one({"_id": quiz["_id"]}, {"$set": {"attempted": True}})
    return jsonify(
        {
            "success": True,
            "attempt_id": str(inserted.inserted_id),
            "score": score,
            "total": total,
            "percentage": percentage,
            "time_spent_seconds": time_spent,
            "results": results,
        }
    )


@bp.get("/<quiz_id>")
@require_auth
def get_quiz(quiz_id):
    return jsonify({"success": True, "quiz": serialize(owned(Collections.QUIZZES, quiz_id, "quiz"))})


@bp.get("/project/<project_id>")
@require_auth
def project_attempts(project_id):
    owned_project(project_id, {"_id": 1})
    attempts = (
        get_db()[Collections.QUIZ_ATTEMPTS]
        .find({"project_id": project_id, "user_id": g.user_id, "kind": {"$ne": "written"}}, {"results": 0})
        .sort("submitted_at", -1)
        .limit(50)
    )
    return jsonify({"success": True, "attempts": serialize(list(attempts))})
