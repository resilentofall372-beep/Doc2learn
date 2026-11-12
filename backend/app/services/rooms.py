"""Live quiz rooms, persisted in MongoDB so a restart does not lose them.

Participants hold a private token issued when they join; socket events must
present it, so a guest cannot act as the host or as another player.

Participant lists are updated read-modify-write under a per-room lock. The app
runs as a single process (see Dockerfile), so the lock is sufficient; a
multi-process deployment would move this to Mongo transactions or Redis.
"""
from __future__ import annotations

import secrets
import threading
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from ..errors import ApiError
from ..extensions import Collections, get_db
from ..utils import random_code

PUBLIC_QUESTION_KEYS = ("question", "options", "source_page")

_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _participant(pid: str, name: str, avatar: str, is_host: bool) -> dict:
    return {
        "id": pid,
        "name": name,
        "avatar": avatar,
        "is_host": is_host,
        "score": 0,
        "answers": [],
        "token": secrets.token_urlsafe(16),
        "joined_at": _now(),
    }


def _reload(room: dict) -> dict:
    return get_db()[Collections.ROOMS].find_one({"_id": room["_id"]})


def _set(room: dict, fields: dict) -> dict:
    get_db()[Collections.ROOMS].update_one({"_id": room["_id"]}, {"$set": fields})
    return _reload(room)


# --------------------------------------------------------------------------- views
def public_question(question: dict) -> dict:
    return {k: question.get(k) for k in PUBLIC_QUESTION_KEYS}


def public_room(room: dict) -> dict:
    """Room as sent to clients: no tokens, no correct answers."""
    out = {k: v for k, v in room.items() if k not in ("_id", "questions")}
    out["participants"] = [{k: v for k, v in p.items() if k != "token"} for p in room.get("participants", [])]
    # Correct answers stay server-side while the quiz runs; once it is over they are shown for review.
    finished = room.get("quiz_state") == "completed"
    out["questions"] = [dict(q) if finished else public_question(q) for q in room.get("questions", [])]
    out["question_count"] = len(room.get("questions", []))
    for key in ("created_at", "question_started_at", "started_at", "completed_at", "ended_at"):
        if isinstance(out.get(key), datetime):
            out[key] = out[key].isoformat()
    for p in out["participants"]:
        if isinstance(p.get("joined_at"), datetime):
            p["joined_at"] = p["joined_at"].isoformat()
    return out


def join_summary(room: dict) -> dict:
    count = len(room.get("participants", []))
    return {
        "room_id": room["room_id"],
        "room_code": room["room_code"],
        "room_name": room["room_name"],
        "host_name": room["host_name"],
        "project_name": room.get("project_name"),
        "document_name": room.get("document_name"),
        "num_questions": room["num_questions"],
        "time_per_question": room["time_per_question"],
        "difficulty": room["difficulty"],
        "participants_count": count,
        "max_participants": room["max_participants"],
        "is_full": count >= room["max_participants"],
        "quiz_state": room["quiz_state"],
    }


def leaderboard(room: dict) -> list[dict]:
    rows = sorted(
        ({k: v for k, v in p.items() if k not in ("token", "joined_at")} for p in room.get("participants", [])),
        key=lambda p: p.get("score", 0),
        reverse=True,
    )
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows


# --------------------------------------------------------------------------- lookup
def find_room(identifier: str, *, active_only: bool = True) -> dict | None:
    query: dict = {"$or": [{"room_id": identifier}, {"room_code": identifier.upper()}]}
    if active_only:
        query["is_active"] = True
    return get_db()[Collections.ROOMS].find_one(query)


def require_room(identifier: str) -> dict:
    room = find_room(identifier)
    if not room:
        raise ApiError("Room not found or no longer active", 404)
    return room


def authenticate(room: dict, participant_id: str, token: str) -> dict:
    for p in room.get("participants", []):
        if p["id"] == participant_id and secrets.compare_digest(p.get("token", ""), token or ""):
            return p
    raise ApiError("Not a participant of this room", 403)


def list_open_rooms(limit: int = 50) -> list[dict]:
    rows = (
        get_db()[Collections.ROOMS]
        .find({"is_active": True, "quiz_state": "lobby"})
        .sort("created_at", -1)
        .limit(limit)
    )
    return [join_summary(r) for r in rows]


# --------------------------------------------------------------------------- mutations
def create_room(
    *,
    host_id: str,
    host_name: str,
    room_name: str,
    project_id: str,
    project_name: str | None,
    document_id: str | None,
    document_name: str | None,
    num_questions: int,
    time_per_question: int,
    difficulty: str,
    max_participants: int,
) -> tuple[dict, dict]:
    db = get_db()
    code = random_code()
    while db[Collections.ROOMS].find_one({"room_code": code, "is_active": True}):
        code = random_code()
    host = _participant(host_id, host_name, "👑", True)
    room = {
        "room_id": uuid.uuid4().hex[:12],
        "room_code": code,
        "room_name": room_name,
        "host_id": host_id,
        "host_name": host_name,
        "project_id": project_id,
        "project_name": project_name,
        "document_id": document_id,
        "document_name": document_name,
        "num_questions": num_questions,
        "time_per_question": time_per_question,
        "difficulty": difficulty,
        "max_participants": max_participants,
        "participants": [host],
        "quiz_state": "lobby",
        "current_question_index": 0,
        "questions": [],
        "question_started_at": None,
        "created_at": _now(),
        "is_active": True,
    }
    db[Collections.ROOMS].insert_one(room)
    return room, host


def join_room(room: dict, name: str, avatar: str) -> tuple[dict, dict]:
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "lobby":
            raise ApiError("This quiz has already started", 409)
        if len(room["participants"]) >= room["max_participants"]:
            raise ApiError("This room is full", 409)
        participant = _participant(f"p_{uuid.uuid4().hex[:10]}", name, avatar, False)
        room = _set(room, {"participants": room["participants"] + [participant]})
    return participant, room


def remove_participant(room: dict, participant_id: str) -> dict:
    with _locks[room["room_id"]]:
        room = _reload(room)
        if participant_id == room["host_id"]:
            return _set(room, {"is_active": False, "ended_at": _now(), "quiz_state": "closed"})
        remaining = [p for p in room["participants"] if p["id"] != participant_id]
        return _set(room, {"participants": remaining})


def start_quiz(room: dict, questions: list[dict]) -> dict:
    questions = [
        q for q in questions
        if isinstance(q, dict) and q.get("question") and isinstance(q.get("options"), dict) and q.get("answer")
    ][: room["num_questions"]]
    if not questions:
        raise ApiError("Generate quiz questions before starting", 400)
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "lobby":
            raise ApiError("The quiz has already started", 409)
        if len(room["participants"]) < 2:
            raise ApiError("At least two participants are needed to start", 400)
        participants = [{**p, "score": 0, "answers": []} for p in room["participants"]]
        now = _now()
        return _set(
            room,
            {
                "quiz_state": "in_progress",
                "questions": questions,
                "num_questions": len(questions),
                "current_question_index": 0,
                "question_started_at": now,
                "started_at": now,
                "participants": participants,
            },
        )


def record_answer(room: dict, participant: dict, question_index: int, selected: str) -> tuple[dict, dict]:
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "in_progress":
            raise ApiError("The quiz is not running", 409)
        if question_index != room["current_question_index"]:
            raise ApiError("That question is no longer open", 409)
        participants = room["participants"]
        me = next((p for p in participants if p["id"] == participant["id"]), None)
        if me is None:
            raise ApiError("Not a participant of this room", 403)
        if any(a["question_index"] == question_index for a in me.get("answers", [])):
            raise ApiError("Answer already submitted", 409)

        question = room["questions"][question_index]
        started = room.get("question_started_at")
        if started and started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        limit = room["time_per_question"]
        elapsed = (_now() - started).total_seconds() if started else float(limit)
        elapsed = max(0.0, min(elapsed, limit + 3))  # small grace for network latency
        is_correct = selected == question["answer"]
        earned = 100 + int(50 * max(0.0, 1 - elapsed / limit)) if is_correct else 0
        answer = {
            "question_index": question_index,
            "selected_answer": selected,
            "is_correct": is_correct,
            "time_taken": round(elapsed, 2),
            "score_earned": earned,
        }
        me["answers"] = me.get("answers", []) + [answer]
        me["score"] = me.get("score", 0) + earned
        room = _set(room, {"participants": participants})
    return answer, room


def advance(room: dict) -> tuple[str, dict]:
    """Move to the next question or finish. Returns (event, room)."""
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "in_progress":
            raise ApiError("The quiz is not running", 409)
        next_index = room["current_question_index"] + 1
        if next_index >= len(room["questions"]):
            return "quiz_completed", _set(
                room, {"quiz_state": "completed", "completed_at": _now(), "question_started_at": None}
            )
        return "next_question", _set(room, {"current_question_index": next_index, "question_started_at": _now()})
