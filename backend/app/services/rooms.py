"""Live quiz rooms, persisted in MongoDB so a restart does not lose them.

Roles:
- The host runs the game (generates questions, starts, moves on) but doesn't play.
- Players join with the room code. Each gets a private token that every socket event
  must present, so nobody can act as the host or as another player.

Joining is guarded by the invite: the code works for INVITE_HOURS, only while the
room is in the lobby, and the host can swap it for a new one. Expiry never touches
people already inside: in-game events check tokens, not the invite. Rooms with no
activity for STALE_HOURS are closed, and so are started or finished rooms that have
no players left and no activity for EMPTY_MINUTES.

Participant lists are updated read-modify-write under a per-room lock. The app
runs as a single process (see Dockerfile), so the lock is sufficient; a
multi-process deployment would move this to Mongo transactions or Redis.
"""
from __future__ import annotations

import secrets
import threading
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from ..errors import ApiError
from ..extensions import Collections, get_db
from ..utils import as_utc, random_code, utcnow

PUBLIC_QUESTION_KEYS = ("question", "options", "source_page")
INVITE_HOURS = 2
STALE_HOURS = 6
EMPTY_MINUTES = 30

_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)


def _participant(pid: str, name: str, avatar: str) -> dict:
    return {
        "id": pid,
        "name": name,
        "avatar": avatar,
        "is_host": False,
        "score": 0,
        "answers": [],
        "token": secrets.token_urlsafe(16),
        "joined_at": utcnow(),
    }


def _reload(room: dict) -> dict:
    return get_db()[Collections.ROOMS].find_one({"_id": room["_id"]})


def _set(room: dict, fields: dict) -> dict:
    get_db()[Collections.ROOMS].update_one({"_id": room["_id"]}, {"$set": {**fields, "updated_at": utcnow()}})
    return _reload(room)


def _unique_code() -> str:
    code = random_code()
    while get_db()[Collections.ROOMS].find_one({"room_code": code, "is_active": True}):
        code = random_code()
    return code


def host_of(room: dict) -> dict:
    """The host's record. Rooms made before hosts stopped playing kept the host among the participants."""
    return room.get("host") or next((p for p in room.get("participants", []) if p.get("is_host")), {})


def players(room: dict) -> list[dict]:
    return [p for p in room.get("participants", []) if not p.get("is_host")]


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


# --------------------------------------------------------------------------- views
def public_question(question: dict) -> dict:
    return {k: question.get(k) for k in PUBLIC_QUESTION_KEYS}


def public_room(room: dict) -> dict:
    """Room as sent to clients: no tokens, no correct answers, players only in `participants`."""
    out = {k: v for k, v in room.items() if k not in ("_id", "questions", "host", "participants")}
    out["participants"] = [{k: v for k, v in p.items() if k != "token"} for p in players(room)]
    # Correct answers stay server-side until the quiz is over; then they are shown for review.
    finished = room.get("quiz_state") == "completed"
    out["questions"] = [dict(q) if finished else public_question(q) for q in room.get("questions", [])] if room.get("quiz_state") != "lobby" else []
    out["question_count"] = len(room.get("questions", []))
    for key in ("created_at", "updated_at", "invite_expires_at", "question_started_at", "started_at", "completed_at", "ended_at"):
        out[key] = _iso(out.get(key))
    for p in out["participants"]:
        p["joined_at"] = _iso(p.get("joined_at"))
    return out


def join_summary(room: dict) -> dict:
    count = len(players(room))
    return {
        "room_id": room["room_id"],
        "room_code": room["room_code"],
        "room_name": room["room_name"],
        "host_id": room["host_id"],
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
        "invite_expires_at": _iso(room.get("invite_expires_at")),
    }


def leaderboard(room: dict) -> list[dict]:
    rows = sorted(
        ({k: v for k, v in p.items() if k not in ("token", "joined_at")} for p in players(room)),
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
    room = get_db()[Collections.ROOMS].find_one(query)
    last_activity = as_utc(room.get("updated_at") or room.get("created_at")) if room else None
    idle = utcnow() - last_activity if last_activity else None
    stale = idle is not None and idle > timedelta(hours=STALE_HOURS)
    abandoned = (
        idle is not None
        and idle > timedelta(minutes=EMPTY_MINUTES)
        and room.get("quiz_state") in ("in_progress", "completed")
        and not players(room)
    )
    if room and room.get("is_active") and (stale or abandoned):
        get_db()[Collections.ROOMS].update_one({"_id": room["_id"]}, {"$set": {"is_active": False, "quiz_state": "closed", "ended_at": utcnow()}})
        return None if active_only else _reload(room)
    return room


def require_room(identifier: str) -> dict:
    room = find_room(identifier)
    if not room:
        raise ApiError("Room not found or no longer active", 404)
    return room


def require_invite(code: str) -> dict:
    """The room a join code opens, if the invite is still valid."""
    room = get_db()[Collections.ROOMS].find_one({"room_code": code.upper(), "is_active": True})
    room = room and find_room(room["room_id"])  # applies the stale-room cleanup
    if not room:
        raise ApiError("This code is invalid or the quiz has ended.", 404)
    expires = as_utc(room.get("invite_expires_at"))
    if expires and utcnow() > expires:
        raise ApiError("This invite link has expired. Ask the host for a new one.", 410)
    return room


def authenticate(room: dict, participant_id: str, token: str) -> dict:
    host = host_of(room)
    if host and host.get("id") == participant_id and secrets.compare_digest(host.get("token", ""), token or ""):
        return {**host, "is_host": True}
    for p in players(room):
        if p["id"] == participant_id and secrets.compare_digest(p.get("token", ""), token or ""):
            return p
    raise ApiError("Not a participant of this room", 403)


def hosted_rooms(host_id: str, limit: int = 20) -> list[dict]:
    """A host's own rooms that are still open (rooms are never listed to other people)."""
    rows = get_db()[Collections.ROOMS].find({"host_id": host_id, "is_active": True}).sort("created_at", -1).limit(limit)
    return [join_summary(r) for r in rows if find_room(r["room_id"])]


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
    now = utcnow()
    host = {"id": host_id, "name": host_name, "token": secrets.token_urlsafe(16)}
    room = {
        "room_id": uuid.uuid4().hex[:12],
        "room_code": _unique_code(),
        "invite_expires_at": now + timedelta(hours=INVITE_HOURS),
        "room_name": room_name,
        "host": host,
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
        "participants": [],
        "quiz_state": "lobby",
        "current_question_index": 0,
        "questions": [],
        "question_started_at": None,
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }
    get_db()[Collections.ROOMS].insert_one(room)
    return room, host


def join_room(room: dict, name: str, avatar: str) -> tuple[dict, dict]:
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "lobby":
            raise ApiError("This quiz has already started", 409)
        if len(players(room)) >= room["max_participants"]:
            raise ApiError("This room is full", 409)
        taken = {p["name"].casefold() for p in room["participants"]} | {room["host_name"].casefold()}
        if name.casefold() in taken:
            raise ApiError("That name is taken in this room. Pick another.", 409)
        participant = _participant(f"p_{uuid.uuid4().hex[:10]}", name, avatar)
        room = _set(room, {"participants": room["participants"] + [participant]})
    return participant, room


def remove_participant(room: dict, participant_id: str) -> dict:
    """A player leaves (or is removed by the host); the host leaving closes the room."""
    with _locks[room["room_id"]]:
        room = _reload(room)
        if participant_id == room["host_id"]:
            return _set(room, {"is_active": False, "ended_at": utcnow(), "quiz_state": "closed"})
        remaining = [p for p in room["participants"] if p["id"] != participant_id]
        return _set(room, {"participants": remaining})


def new_invite(room: dict) -> dict:
    """Swap the join code for a fresh one with a fresh expiry. People already inside are unaffected."""
    with _locks[room["room_id"]]:
        room = _reload(room)
        return _set(room, {"room_code": _unique_code(), "invite_expires_at": utcnow() + timedelta(hours=INVITE_HOURS)})


def set_questions(room: dict, questions: list[dict]) -> dict:
    """Store generated questions (with answers) server-side; clients only ever see the count."""
    questions = [
        q for q in questions
        if isinstance(q, dict) and q.get("question") and isinstance(q.get("options"), dict) and q.get("answer")
    ][: room["num_questions"]]
    if not questions:
        raise ApiError("The model did not produce usable questions. Try again.", 502)
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "lobby":
            raise ApiError("The quiz has already started", 409)
        return _set(room, {"questions": questions})


def start_quiz(room: dict) -> dict:
    with _locks[room["room_id"]]:
        room = _reload(room)
        if room["quiz_state"] != "lobby":
            raise ApiError("The quiz has already started", 409)
        if not room.get("questions"):
            raise ApiError("Generate quiz questions before starting", 400)
        if not players(room):
            raise ApiError("Wait for at least one player to join", 400)
        participants = [{**p, "score": 0, "answers": []} for p in players(room)]
        now = utcnow()
        return _set(
            room,
            {
                "quiz_state": "in_progress",
                "num_questions": len(room["questions"]),
                "current_question_index": 0,
                "question_started_at": now,
                "started_at": now,
                "participants": participants,
                "host": host_of(room),  # older rooms kept the host among the participants
            },
        )


def record_answer(room: dict, participant: dict, question_index: int, selected: str) -> tuple[dict, dict]:
    if participant.get("is_host"):
        raise ApiError("The host runs the quiz and doesn't answer", 403)
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
        started = as_utc(room.get("question_started_at"))
        limit = room["time_per_question"]
        elapsed = (utcnow() - started).total_seconds() if started else float(limit)
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
                room, {"quiz_state": "completed", "completed_at": utcnow(), "question_started_at": None}
            )
        return "next_question", _set(room, {"current_question_index": next_index, "question_started_at": utcnow()})
