"""Email + password accounts with JWT sessions."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from pymongo.errors import DuplicateKeyError

from ..auth import hash_password, issue_token, public_user, require_auth, verify_password
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..utils import clean_str

bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _credentials(data: dict) -> tuple[str, str]:
    email = clean_str(data.get("email"), 254).lower()
    password = data.get("password") if isinstance(data.get("password"), str) else ""
    if not _EMAIL_RE.match(email):
        raise ApiError("Enter a valid email address")
    if len(password) < 6:
        raise ApiError("Password must be at least 6 characters")
    if len(password) > 128:
        raise ApiError("Password is too long")
    return email, password


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email, password = _credentials(data)
    name = clean_str(data.get("name"), 80)
    if len(name) < 2:
        raise ApiError("Name must be at least 2 characters")

    # The unique index is the real guarantee; this check gives a clean error even
    # if the index could not be built (e.g. legacy duplicate rows in an old database).
    if get_db()[Collections.USERS].find_one({"email": email}, {"_id": 1}):
        raise ApiError("An account with this email already exists", 409)

    user = {
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "token_version": 0,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = get_db()[Collections.USERS].insert_one(user)
    except DuplicateKeyError:
        raise ApiError("An account with this email already exists", 409)
    user["_id"] = result.inserted_id
    return jsonify({"success": True, "token": issue_token(user), "user": public_user(user)}), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email, password = _credentials(data)
    user = get_db()[Collections.USERS].find_one({"email": email})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise ApiError("Incorrect email or password", 401)
    return jsonify({"success": True, "token": issue_token(user), "user": public_user(user)})


@bp.post("/logout")
@require_auth
def logout():
    """Revoke every token for this user (all devices) by bumping token_version."""
    get_db()[Collections.USERS].update_one({"_id": g.user["_id"]}, {"$inc": {"token_version": 1}})
    return jsonify({"success": True})


@bp.get("/me")
@require_auth
def me():
    return jsonify({"success": True, "user": public_user(g.user)})
