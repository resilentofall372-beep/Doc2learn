"""REST side of live quiz rooms. Real-time play happens over Socket.IO (see sockets.py)."""
from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from ..auth import optional_auth, require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import rooms
from ..utils import clamp, clean_str, to_object_id

bp = Blueprint("rooms", __name__)

DIFFICULTIES = {"easy", "medium", "hard"}
DEFAULT_AVATAR = "🙂"


@bp.post("/create")
@require_auth
def create():
    data = request.get_json(silent=True) or {}
    room_name = clean_str(data.get("room_name"), 60) or f"{g.user['name']}'s quiz"
    difficulty = data.get("difficulty") if data.get("difficulty") in DIFFICULTIES else "medium"

    document_id = data.get("document_id") or None
    document_name = None
    if document_id:
        doc = get_db()[Collections.DOCUMENTS].find_one(
            {"_id": to_object_id(document_id, "document id")}, {"user_id": 1, "filename": 1}
        )
        if not doc or doc["user_id"] != g.user_id:
            raise ApiError("Document not found", 404)
        document_name = doc["filename"]

    room, host = rooms.create_room(
        host_id=g.user_id,
        host_name=g.user["name"],
        room_name=room_name,
        document_id=document_id,
        document_name=document_name,
        num_questions=clamp(data.get("num_questions"), 3, 25, 10),
        time_per_question=clamp(data.get("time_per_question"), 10, 120, 30),
        difficulty=difficulty,
        max_participants=clamp(data.get("max_participants"), 2, 100, 20),
    )
    return (
        jsonify(
            {
                "success": True,
                "room_id": room["room_id"],
                "room_code": room["room_code"],
                "share_link": f"/join/{room['room_code']}",
                "participant_id": host["id"],
                "participant_token": host["token"],
                "room": rooms.public_room(room),
            }
        ),
        201,
    )


@bp.post("/join")
@optional_auth
def join():
    data = request.get_json(silent=True) or {}
    code = clean_str(data.get("room_code") or data.get("room_id"), 20)
    if not code:
        raise ApiError("room_code is required")
    room = rooms.require_room(code)

    fallback = g.user["name"] if g.user else ""
    name = clean_str(data.get("participant_name") or data.get("user_name"), 30) or fallback
    if len(name) < 2:
        raise ApiError("Enter a name of at least 2 characters")
    avatar = clean_str(data.get("avatar"), 4) or DEFAULT_AVATAR

    participant, room = rooms.join_room(room, name, avatar)
    payload = rooms.public_room(room)
    from ..extensions import socketio

    socketio.emit(
        "participant_joined",
        {"participants": payload["participants"], "message": f"{name} joined the room"},
        to=room["room_id"],
    )
    return jsonify(
        {
            "success": True,
            "room": payload,
            "participant_id": participant["id"],
            "participant_token": participant["token"],
        }
    )


@bp.get("/rooms")
def open_rooms():
    return jsonify({"success": True, "rooms": rooms.list_open_rooms()})


@bp.get("/code/<room_code>")
def by_code(room_code):
    return jsonify({"success": True, "room": rooms.join_summary(rooms.require_room(room_code))})


@bp.get("/<room_id>")
def get_room(room_id):
    room = rooms.find_room(room_id, active_only=False)
    if not room:
        raise ApiError("Room not found", 404)
    return jsonify({"success": True, "room": rooms.public_room(room)})


@bp.post("/leave")
def leave():
    data = request.get_json(silent=True) or {}
    room = rooms.require_room(clean_str(data.get("room_id"), 20))
    participant = rooms.authenticate(room, data.get("participant_id", ""), data.get("participant_token", ""))
    room = rooms.remove_participant(room, participant["id"])
    from ..extensions import socketio

    event = "room_closed" if participant["is_host"] else "participant_left"
    socketio.emit(
        event,
        {
            "participants": rooms.public_room(room)["participants"],
            "message": f"{participant['name']} left the room" if not participant["is_host"] else "The host closed the room",
        },
        to=room["room_id"],
    )
    return jsonify({"success": True})
