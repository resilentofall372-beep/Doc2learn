def test_register_login_me(client):
    res = client.post("/api/auth/register", json={"name": "Sam", "email": "sam@example.com", "password": "secret123"})
    assert res.status_code == 201
    token = res.get_json()["token"]

    dup = client.post("/api/auth/register", json={"name": "Sam", "email": "SAM@example.com", "password": "secret123"})
    assert dup.status_code == 409

    bad = client.post("/api/auth/login", json={"email": "sam@example.com", "password": "wrongpass"})
    assert bad.status_code == 401

    ok = client.post("/api/auth/login", json={"email": "sam@example.com", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.get_json()["user"]["name"] == "Sam"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.get_json()["user"]["email"] == "sam@example.com"


def test_logout_revokes_every_token(client):
    first = client.post("/api/auth/register", json={"name": "Sam", "email": "sam@example.com", "password": "secret123"}).get_json()["token"]
    second = client.post("/api/auth/login", json={"email": "sam@example.com", "password": "secret123"}).get_json()["token"]
    for token in (first, second):
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    assert client.post("/api/auth/logout", headers={"Authorization": f"Bearer {second}"}).status_code == 200

    # both the token used to log out and the one from the "other device" stop working
    for token in (first, second):
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    # logging in again works
    fresh = client.post("/api/auth/login", json={"email": "sam@example.com", "password": "secret123"}).get_json()["token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh}"}).status_code == 200


def test_protected_routes_need_token(client):
    assert client.get("/api/projects/").status_code == 401
    assert client.get("/api/stats/me").status_code == 401
    assert client.get("/api/projects/", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_validation(client):
    assert client.post("/api/auth/register", json={"name": "S", "email": "x", "password": "1"}).status_code == 400
