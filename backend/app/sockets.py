"""Socket.IO events for live quiz rooms.

Client -> server: join_room, leave_room, start_quiz, submit_answer, next_question
Server -> room:   participant_joined, participant_left, room_closed, quiz_started,
                  answer_submitted, leaderboard_update, next_question, quiz_completed
Server -> caller: error, joined
"""
from __future__ import annotations

import logging
from functools import wraps

from flask import request
from flask_socketio import emit, join_room as sio_join, leave_room as sio_leave

from .errors import ApiError
from .services import rooms

log = logging.getLogger(__name__)


def _handler(fn):
    """Turn ApiError and unexpected exceptions into an `error` event for the caller."""

    @wraps(fn)
    def wrapper(data=None):
        data = data if isinstance(data, dict) else {}
        try:
            return fn(data)
        except ApiError as exc:
            emit("error", {"message": exc.message, "status": exc.status})
        except Exception:  # noqa: BLE001
            log.exception("Socket handler %s failed", fn.__name__)
            emit("error", {"message": "Something went wrong on the server", "status": 500})

    return wrapper


def _auth(data: dict) -> tuple[dict, dict]:
    room = rooms.require_room(str(data.get("room_id", "")))
    participant = rooms.authenticate(room, str(data.get("participant_id", "")), str(data.get("participant_token", "")))
    return room, participant


def _host_only(room: dict, participant: dict) -> None:
    if participant["id"] != room["host_id"]:
        raise ApiError("Only the host can do that", 403)


def _question_payload(room: dict) -> dict:
    index = room["current_question_index"]
    return {
        "question_index": index,
        "question": rooms.public_question(room["questions"][index]),
        "total_questions": len(room["questions"]),
        "time_per_question": room["time_per_question"],
        "question_started_at": room["question_started_at"].isoformat() if room.get("question_started_at") else None,
    }


def on_connect():
    log.debug("socket connected: %s", request.sid)


@_handler
def on_join(data):
    room, participant = _auth(data)
    sio_join(room["room_id"])
    payload = rooms.public_room(room)
    emit("joined", {"room": payload, "participant_id": participant["id"]})
    emit(
        "participant_joined",
        {"participants": payload["participants"], "message": f"{participant['name']} is here"},
        to=room["room_id"],
    )


@_handler
def on_leave(data):
    room, participant = _auth(data)
    sio_leave(room["room_id"])
    room = rooms.remove_participant(room, participant["id"])
    payload = rooms.public_room(room)
    if participant["is_host"]:
        emit("room_closed", {"participants": payload["participants"], "message": "The host closed the room"}, to=room["room_id"])
    else:
        emit(
            "participant_left",
            {"participants": payload["participants"], "message": f"{participant['name']} left"},
            to=room["room_id"],
        )


@_handler
def on_start(data):
    room, participant = _auth(data)
    _host_only(room, participant)
    room = rooms.start_quiz(room, data.get("questions") or [])
    emit("quiz_started", _question_payload(room), to=room["room_id"])


@_handler
def on_answer(data):
    room, participant = _auth(data)
    try:
        question_index = int(data.get("question_index"))
    except (TypeError, ValueError):
        raise ApiError("question_index must be a number")
    selected = str(data.get("selected_answer", "")).strip().upper()[:1]
    if selected not in ("A", "B", "C", "D"):
        raise ApiError("selected_answer must be A, B, C or D")

    answer, room = rooms.record_answer(room, participant, question_index, selected)
    answered = sum(1 for p in room["participants"] if any(a["question_index"] == question_index for a in p["answers"]))
    emit("answer_result", answer)  # only the answering client learns if it was correct
    emit(
        "answer_submitted",
        {
            "participant_id": participant["id"],
            "question_index": question_index,
            "answers_count": answered,
            "total_participants": len(room["participants"]),
        },
        to=room["room_id"],
    )
    emit("leaderboard_update", {"leaderboard": rooms.leaderboard(room)}, to=room["room_id"])


@_handler
def on_next(data):
    room, participant = _auth(data)
    _host_only(room, participant)
    event, room = rooms.advance(room)
    if event == "quiz_completed":
        emit(
            "quiz_completed",
            {
                "leaderboard": rooms.leaderboard(room),
                "total_questions": len(room["questions"]),
                "questions": room["questions"],  # full questions for review, now that play is over
            },
            to=room["room_id"],
        )
    else:
        emit("next_question", _question_payload(room), to=room["room_id"])


def register(sio) -> None:
    """Attach handlers to the given SocketIO instance (called from create_app).

    Registering here, rather than with decorators at import time, means every
    app instance (including test apps) gets a server with handlers attached.
    """
    sio.on_event("connect", on_connect)
    sio.on_event("join_room", on_join)
    sio.on_event("leave_room", on_leave)
    sio.on_event("start_quiz", on_start)
    sio.on_event("submit_answer", on_answer)
    sio.on_event("next_question", on_next)
