"""Quiz attempts: server-side grading and history."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..utils import clamp, serialize, to_object_id
from .documents import owned_document

bp = Blueprint("quiz", __name__)


@bp.post("/submit")
@require_auth
def submit():
    data = request.get_json(silent=True) or {}
    quiz_id = data.get("quiz_id")
    answers = data.get("answers") if isinstance(data.get("answers"), dict) else {}
    time_spent = clamp(data.get("time_spent_seconds"), 0, 24 * 3600, 0)

    quiz = get_db()[Collections.QUIZZES].find_one({"_id": to_object_id(quiz_id, "quiz id")})
    if not quiz:
        raise ApiError("Quiz not found", 404)
    owned_document(quiz["document_id"], {"_id": 1})

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
                "source_page": question.get("source_page"),
            }
        )
    total = len(quiz["questions"])
    percentage = round(100 * score / total) if total else 0

    attempt = {
        "quiz_id": str(quiz["_id"]),
        "document_id": quiz["document_id"],
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
    quiz = get_db()[Collections.QUIZZES].find_one({"_id": to_object_id(quiz_id, "quiz id")})
    if not quiz:
        raise ApiError("Quiz not found", 404)
    owned_document(quiz["document_id"], {"_id": 1})
    return jsonify({"success": True, "quiz": serialize(quiz)})


@bp.get("/document/<document_id>")
@require_auth
def document_attempts(document_id):
    owned_document(document_id, {"_id": 1})
    attempts = (
        get_db()[Collections.QUIZ_ATTEMPTS]
        .find({"document_id": document_id, "user_id": g.user_id}, {"results": 0})
        .sort("submitted_at", -1)
        .limit(50)
    )
    return jsonify({"success": True, "attempts": serialize(list(attempts))})
