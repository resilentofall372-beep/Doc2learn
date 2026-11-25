from datetime import datetime, timedelta

from app.extensions import Collections, get_db
from tests.conftest import FAKE_QUIZ


def _events(received, name):
    return [r["args"][0] for r in received if r["name"] == name]


def _make_room(client, headers, project_id, **extra):
    res = client.post("/api/room/create", json={"room_name": "Bio battle", "project_id": project_id, "num_questions": 2, **extra}, headers=headers)
    assert res.status_code == 201, res.get_json()
    room = res.get_json()
    creds = {"room_id": room["room_id"], "participant_id": room["participant_id"], "participant_token": room["participant_token"]}
    return room, creds


def _join(client, code, name):
    return client.post("/api/room/join", json={"room_code": code, "participant_name": name, "avatar": "c1"})


def _creds(room, joined):
    body = joined.get_json()
    return {"room_id": room["room_id"], "participant_id": body["participant_id"], "participant_token": body["participant_token"]}


def test_room_lifecycle_over_sockets(client, document, sio):
    headers, _, doc_id, project_id = document
    room, host_creds = _make_room(client, headers, project_id, document_id=doc_id)
    assert room["room"]["project_name"] == "Biology 101"
    assert room["room"]["participants"] == []  # the host runs the game, they aren't a player

    # a guest (no account) joins by code; the host doesn't take a player slot
    joined = _join(client, room["room_code"], "Guest")
    assert joined.status_code == 200, joined.get_json()
    guest_creds = _creds(room, joined)
    summary = client.get(f"/api/room/code/{room['room_code']}").get_json()["room"]
    assert summary["participants_count"] == 1 and summary["host_id"] == room["participant_id"]

    # questions are written and kept on the server; only the host can ask for them
    assert client.post(f"/api/room/{room['room_id']}/questions", json=guest_creds).status_code == 403
    made = client.post(f"/api/room/{room['room_id']}/questions", json=host_creds)
    assert made.status_code == 200 and made.get_json()["question_count"] == 2
    assert "answer" not in str(client.get(f"/api/room/{room['room_id']}").get_json()["room"]["questions"])

    host_sock, guest_sock = sio(client), sio(client)
    host_sock.emit("join_room", host_creds)
    guest_sock.emit("join_room", guest_creds)
    assert _events(host_sock.get_received(), "joined")

    # guest cannot start; wrong token cannot act
    guest_sock.emit("start_quiz", guest_creds)
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 403
    guest_sock.emit("submit_answer", {**guest_creds, "participant_token": "bad", "question_index": 0, "selected_answer": "A"})
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 403

    # questions sent by the client are ignored: the stored ones are used
    tampered = [{**FAKE_QUIZ["questions"][0], "answer": "D"}]
    host_sock.emit("start_quiz", {**host_creds, "questions": tampered})
    started = _events(guest_sock.get_received(), "quiz_started")
    assert started and started[0]["total_questions"] == 2
    assert "answer" not in started[0]["question"]
    host_sock.get_received()

    guest_sock.emit("submit_answer", {**guest_creds, "question_index": 0, "selected_answer": "A"})
    received = guest_sock.get_received()
    assert _events(received, "answer_result")[0]["is_correct"] is True
    assert _events(received, "leaderboard_update")[-1]["leaderboard"][0]["id"] == guest_creds["participant_id"]
    guest_sock.emit("submit_answer", {**guest_creds, "question_index": 0, "selected_answer": "B"})
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 409

    # the host doesn't answer
    host_sock.emit("submit_answer", {**host_creds, "question_index": 0, "selected_answer": "A"})
    assert _events(host_sock.get_received(), "error")[0]["status"] == 403

    host_sock.emit("next_question", host_creds)
    assert _events(guest_sock.get_received(), "next_question")[0]["question_index"] == 1
    host_sock.emit("next_question", host_creds)
    done = _events(guest_sock.get_received(), "quiz_completed")
    assert [p["id"] for p in done[0]["leaderboard"]] == [guest_creds["participant_id"]]
    assert done[0]["questions"][0]["answer"] == "A"

    assert client.get(f"/api/room/{room['room_id']}").get_json()["room"]["quiz_state"] == "completed"
    assert _join(client, room["room_code"], "Late").status_code == 409


def test_expired_invite_blocks_joining_but_not_playing(app, client, document, sio):
    headers, _, _, project_id = document
    room, host_creds = _make_room(client, headers, project_id)
    guest_creds = _creds(room, _join(client, room["room_code"], "Guest"))
    client.post(f"/api/room/{room['room_id']}/questions", json=host_creds)

    with app.app_context():
        get_db()[Collections.ROOMS].update_one({"room_id": room["room_id"]}, {"$set": {"invite_expires_at": datetime.utcnow() - timedelta(minutes=1)}})
    assert client.get(f"/api/room/code/{room['room_code']}").status_code == 410
    assert _join(client, room["room_code"], "Late").status_code == 410

    # people already inside carry on
    host_sock, guest_sock = sio(client), sio(client)
    host_sock.emit("join_room", host_creds)
    guest_sock.emit("join_room", guest_creds)
    host_sock.emit("start_quiz", host_creds)
    assert _events(guest_sock.get_received(), "quiz_started")
    guest_sock.emit("submit_answer", {**guest_creds, "question_index": 0, "selected_answer": "A"})
    assert _events(guest_sock.get_received(), "answer_result")[0]["is_correct"] is True


def test_new_link_replaces_the_old_code(app, client, document):
    headers, _, _, project_id = document
    room, host_creds = _make_room(client, headers, project_id)
    guest_creds = _creds(room, _join(client, room["room_code"], "Guest"))
    assert client.post(f"/api/room/{room['room_id']}/new-code", json=guest_creds).status_code == 403

    fresh = client.post(f"/api/room/{room['room_id']}/new-code", json=host_creds).get_json()["room"]
    assert fresh["room_code"] != room["room_code"]
    assert client.get(f"/api/room/code/{room['room_code']}").status_code == 404
    assert _join(client, fresh["room_code"], "Second").status_code == 200
    assert [p["name"] for p in fresh["participants"]] == ["Guest"]  # nobody inside was dropped


def test_names_are_unique_and_host_can_remove_players(client, document, sio):
    headers, user, _, project_id = document
    room, host_creds = _make_room(client, headers, project_id)
    assert _join(client, room["room_code"], user["name"].upper()).status_code == 409  # can't pose as the host
    guest_creds = _creds(room, _join(client, room["room_code"], "Guest"))
    assert _join(client, room["room_code"], "guest").status_code == 409

    host_sock, guest_sock = sio(client), sio(client)
    host_sock.emit("join_room", host_creds)
    guest_sock.emit("join_room", guest_creds)
    guest_sock.emit("kick_player", {**guest_creds, "target_id": guest_creds["participant_id"]})
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 403

    host_sock.emit("kick_player", {**host_creds, "target_id": guest_creds["participant_id"]})
    removed = _events(guest_sock.get_received(), "participant_removed")
    assert removed and removed[0]["participant_id"] == guest_creds["participant_id"]
    guest_sock.emit("join_room", guest_creds)  # their token no longer works
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 403


def test_rooms_are_listed_only_to_their_host(client, auth, document):
    headers, _, _, project_id = document
    _make_room(client, headers, project_id)
    assert client.get("/api/room/rooms").status_code == 401
    assert len(client.get("/api/room/rooms", headers=headers).get_json()["rooms"]) == 1
    other_headers, _ = auth(email="eve@example.com", name="Eve")
    assert client.get("/api/room/rooms", headers=other_headers).get_json()["rooms"] == []


def test_room_requires_owned_project(client, auth, document):
    _, _, doc_id, project_id = document
    other_headers, _ = auth(email="eve@example.com", name="Eve")
    res = client.post("/api/room/create", json={"room_name": "x", "project_id": project_id, "document_id": doc_id}, headers=other_headers)
    assert res.status_code == 404


def test_host_leaving_closes_room(client, document):
    headers, _, _, project_id = document
    room, host_creds = _make_room(client, headers, project_id)
    assert client.post("/api/room/leave", json=host_creds).status_code == 200
    assert client.get(f"/api/room/code/{room['room_code']}").status_code == 404
