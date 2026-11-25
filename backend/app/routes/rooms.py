"""REST side of live quiz rooms. Real-time play happens over Socket.IO (see sockets.py)."""
from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from ..access import owned_document, resolve_scope
from ..auth import optional_auth, require_auth
from ..errors import ApiError
from ..services import generation, rooms
from ..utils import clamp, clean_str

bp = Blueprint("rooms", __name__)

DIFFICULTIES = {"easy", "medium", "hard"}
DEFAULT_AVATAR = "🙂"


def _host_room(room_id: str) -> dict:
    """The room, if the request carries the host's credentials."""
    data = request.get_json(silent=True) or {}
    room = rooms.require_room(clean_str(room_id, 20))
    if not rooms.authenticate(room, data.get("participant_id", ""), data.get("participant_token", "")).get("is_host"):
        raise ApiError("Only the host can do that", 403)
    return room


@bp.post("/create")
@require_auth
def create():
    data = request.get_json(silent=True) or {}
    room_name = clean_str(data.get("room_name"), 60) or f"{g.user['name']}'s quiz"
    difficulty = data.get("difficulty") if data.get("difficulty") in DIFFICULTIES else "medium"

    # Questions come from one of the host's projects (optionally narrowed to one document).
    scope = resolve_scope(data)
    document_name = None
    if scope["document_id"]:
        document_name = owned_document(scope["document_id"], {"filename": 1}).get("filename")

    room, host = rooms.create_room(
        host_id=g.user_id,
        host_name=g.user["name"],
        room_name=room_name,
        project_id=scope["project_id"],
        project_name=scope["project"].get("name"),
        document_id=scope["document_id"],
        document_name=document_name,
        num_questions=clamp(data.get("num_questions"), 3, 25, 10),
        time_per_question=clamp(data.get("time_per_question"), 10, 120, 30),
        difficulty=difficulty,
        max_participants=clamp(data.get("max_participants"), 1, 100, 20),
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
    room = rooms.require_invite(code)

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
@require_auth
def my_rooms():
    """Your own open rooms. Other people's rooms are never listed: the code is the only way in."""
    return jsonify({"success": True, "rooms": rooms.hosted_rooms(g.user_id)})


@bp.get("/code/<room_code>")
def by_code(room_code):
    return jsonify({"success": True, "room": rooms.join_summary(rooms.require_invite(room_code))})


@bp.post("/<room_id>/questions")
def generate_questions(room_id):
    """Host only: write the room's questions. They stay on the server; the host gets the count."""
    room = _host_room(room_id)
    questions = generation.generate_quiz(
        {"project_id": room["project_id"], "document_id": room.get("document_id")}, room["num_questions"], room["difficulty"]
    )
    room = rooms.set_questions(room, questions)
    return jsonify({"success": True, "question_count": len(room["questions"])})


@bp.post("/<room_id>/new-code")
def new_code(room_id):
    """Host only: replace the invite code (the old link stops working; nobody inside is affected)."""
    room = rooms.new_invite(_host_room(room_id))
    return jsonify({"success": True, "room": rooms.public_room(room)})


@bp.get("/<room_id>/host")
@require_auth
def host_identity(room_id):
    """The host's room credentials, for the signed-in host on a browser that lost them."""
    room = rooms.require_room(clean_str(room_id, 20))
    host = rooms.host_of(room)
    if room.get("host_id") != g.user_id or not host:
        raise ApiError("Room not found", 404)
    return jsonify({"success": True, "participant_id": host["id"], "participant_token": host["token"]})


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

    event = "room_closed" if participant.get("is_host") else "participant_left"
    socketio.emit(
        event,
        {
            "participants": rooms.public_room(room)["participants"],
            "message": f"{participant['name']} left the room" if not participant.get("is_host") else "The host closed the room",
        },
        to=room["room_id"],
    )
    return jsonify({"success": True})
