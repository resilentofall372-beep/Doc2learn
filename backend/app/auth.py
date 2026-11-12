"""Password hashing, JWT issuing/verification and the `require_auth` decorator.

Sessions are stateless JWTs (HS256, signed with SECRET_KEY) sent as
`Authorization: Bearer <token>`. Each token also carries the user's
`token_version`; logging out bumps that number, which invalidates every token
issued before it, on every device.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from bson import ObjectId
from flask import current_app, g, request

from .errors import ApiError
from .extensions import Collections, get_db


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def issue_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["_id"]),
        "ver": int(user.get("token_version", 0)),
        "iat": now,
        "exp": now + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """Return the payload of a valid, unexpired token, or None."""
    try:
        return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def public_user(doc: dict) -> dict:
    user_id = str(doc["_id"])
    return {
        "user_id": user_id,
        "uid": user_id,  # kept for older frontend code paths
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }


def user_from_token(token: str | None) -> dict | None:
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        return None
    user = get_db()[Collections.USERS].find_one({"_id": ObjectId(user_id)})
    if user is None:
        return None
    # A logout raises token_version, so older tokens no longer match.
    if int(payload.get("ver", 0)) != int(user.get("token_version", 0)):
        return None
    return user


def _bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None


def require_auth(fn):
    """Reject the request unless a valid bearer token identifies a user.

    The authenticated user document is stored on `g.user`, and `g.user_id`
    holds its string id. Routes never trust a client-supplied user id.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = user_from_token(_bearer_token())
        if user is None:
            raise ApiError("Authentication required", 401)
        g.user = user
        g.user_id = str(user["_id"])
        return fn(*args, **kwargs)

    return wrapper


def optional_auth(fn):
    """Populate `g.user` when a token is present, but allow anonymous access."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = user_from_token(_bearer_token())
        g.user = user
        g.user_id = str(user["_id"]) if user else None
        return fn(*args, **kwargs)

    return wrapper
