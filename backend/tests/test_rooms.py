from tests.conftest import FAKE_QUIZ


def _events(received, name):
    return [r["args"][0] for r in received if r["name"] == name]


def test_room_lifecycle_over_sockets(client, document, sio):
    headers, host_user, doc_id, project_id = document

    created = client.post(
        "/api/room/create",
        json={"room_name": "Bio battle", "project_id": project_id, "document_id": doc_id, "num_questions": 2, "time_per_question": 20},
        headers=headers,
    )
    assert created.status_code == 201, created.get_json()
    room = created.get_json()
    assert room["room"]["project_id"] == project_id and room["room"]["project_name"] == "Biology 101"
    assert room["room"]["participants"][0]["is_host"] is True
    assert "token" not in room["room"]["participants"][0]

    # a guest (no account) joins by code
    joined = client.post("/api/room/join", json={"room_code": room["room_code"], "participant_name": "Guest", "avatar": "🚀"})
    assert joined.status_code == 200, joined.get_json()
    guest = joined.get_json()
    assert len(guest["room"]["participants"]) == 2

    assert client.get("/api/room/rooms").get_json()["rooms"][0]["participants_count"] == 2
    assert client.get(f"/api/room/code/{room['room_code']}").get_json()["room"]["is_full"] is False

    host_sock = sio(client)
    guest_sock = sio(client)
    host_creds = {"room_id": room["room_id"], "participant_id": room["participant_id"], "participant_token": room["participant_token"]}
    guest_creds = {"room_id": room["room_id"], "participant_id": guest["participant_id"], "participant_token": guest["participant_token"]}
    host_sock.emit("join_room", host_creds)
    guest_sock.emit("join_room", guest_creds)
    assert _events(host_sock.get_received(), "joined")

    # guest cannot start; wrong token cannot act
    guest_sock.emit("start_quiz", {**guest_creds, "questions": FAKE_QUIZ["questions"]})
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 403
    guest_sock.emit("submit_answer", {**guest_creds, "participant_token": "bad", "question_index": 0, "selected_answer": "A"})
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 403

    host_sock.emit("start_quiz", {**host_creds, "questions": FAKE_QUIZ["questions"]})
    started = _events(guest_sock.get_received(), "quiz_started")
    assert started and started[0]["total_questions"] == 2
    assert "answer" not in started[0]["question"]  # correct answer never leaves the server
    host_sock.get_received()

    guest_sock.emit("submit_answer", {**guest_creds, "question_index": 0, "selected_answer": "A"})
    received = guest_sock.get_received()
    result = _events(received, "answer_result")[0]
    assert result["is_correct"] is True and result["score_earned"] >= 100
    board = _events(received, "leaderboard_update")[-1]["leaderboard"]
    assert board[0]["id"] == guest["participant_id"]

    guest_sock.emit("submit_answer", {**guest_creds, "question_index": 0, "selected_answer": "B"})
    assert _events(guest_sock.get_received(), "error")[0]["status"] == 409

    host_sock.emit("next_question", host_creds)
    nxt = _events(guest_sock.get_received(), "next_question")
    assert nxt and nxt[0]["question_index"] == 1
    host_sock.get_received()

    host_sock.emit("submit_answer", {**host_creds, "question_index": 1, "selected_answer": "D"})
    assert _events(host_sock.get_received(), "answer_result")[0]["is_correct"] is False

    host_sock.emit("next_question", host_creds)
    done = _events(guest_sock.get_received(), "quiz_completed")
    assert done and done[0]["leaderboard"][0]["id"] == guest["participant_id"]
    assert done[0]["questions"][0]["answer"] == "A"

    state = client.get(f"/api/room/{room['room_id']}").get_json()["room"]
    assert state["quiz_state"] == "completed"
    assert client.post("/api/room/join", json={"room_code": room["room_code"], "participant_name": "Late"}).status_code == 409


def test_room_requires_owned_project(client, auth, document):
    _, _, doc_id, project_id = document
    other_headers, _ = auth(email="eve@example.com", name="Eve")
    res = client.post("/api/room/create", json={"room_name": "x", "project_id": project_id, "document_id": doc_id}, headers=other_headers)
    assert res.status_code == 404


def test_host_leaving_closes_room(client, document):
    headers, _, _, project_id = document
    room = client.post("/api/room/create", json={"room_name": "Solo", "project_id": project_id}, headers=headers).get_json()
    res = client.post(
        "/api/room/leave",
        json={"room_id": room["room_id"], "participant_id": room["participant_id"], "participant_token": room["participant_token"]},
    )
    assert res.status_code == 200
    assert client.get(f"/api/room/code/{room['room_code']}").status_code == 404
