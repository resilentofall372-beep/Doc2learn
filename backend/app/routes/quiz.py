"""Quiz attempts: server-side grading and history."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..access import owned_project
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..utils import clamp, serialize, to_object_id

bp = Blueprint("quiz", __name__)


def _owned_quiz(quiz_id: str) -> dict:
    quiz = get_db()[Collections.QUIZZES].find_one({"_id": to_object_id(quiz_id, "quiz id"), "user_id": g.user_id})
    if not quiz:
        raise ApiError("Quiz not found", 404)
    return quiz


@bp.post("/submit")
@require_auth
def submit():
    data = request.get_json(silent=True) or {}
    quiz = _owned_quiz(data.get("quiz_id"))
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
        "time_spent_seconds": time_spent,
        "results": results,
        "submitted_at": datetime.now(timezone.utc),
    }
    inserted = get_db()[Collections.QUIZ_ATTEMPTS].insert_one(attempt)
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
    return jsonify({"success": True, "quiz": serialize(_owned_quiz(quiz_id))})


@bp.get("/project/<project_id>")
@require_auth
def project_attempts(project_id):
    owned_project(project_id, {"_id": 1})
    attempts = (
        get_db()[Collections.QUIZ_ATTEMPTS]
        .find({"project_id": project_id, "user_id": g.user_id}, {"results": 0})
        .sort("submitted_at", -1)
        .limit(50)
    )
    return jsonify({"success": True, "attempts": serialize(list(attempts))})
