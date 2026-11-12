"""Shared extension instances: MongoDB handle and Socket.IO server."""
from __future__ import annotations

import logging

from flask import Flask, current_app
from flask_socketio import SocketIO
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError

log = logging.getLogger(__name__)

socketio = SocketIO()

_state: dict = {"db": None, "client": None}


class Collections:
    USERS = "users"
    DOCUMENTS = "documents"
    CHUNKS = "chunks"
    QUIZZES = "quizzes"
    QUIZ_ATTEMPTS = "quiz_attempts"
    FLASHCARDS = "flashcards"
    MINDMAPS = "mindmaps"
    CHAT_SESSIONS = "chat_sessions"
    ROOMS = "rooms"


def init_db(app: Flask, db=None) -> None:
    """Connect to MongoDB (or adopt an injected database for tests)."""
    if db is None:
        client = MongoClient(app.config["MONGO_URI"], serverSelectionTimeoutMS=5000)
        db = client.get_default_database("doc2learn")
        _state["client"] = client
    _state["db"] = db
    app.extensions["mongo_db"] = db
    _ensure_indexes(db)


def _ensure_indexes(db) -> None:
    try:
        db[Collections.USERS].create_index("email", unique=True)
        db[Collections.DOCUMENTS].create_index([("user_id", ASCENDING), ("uploaded_on", DESCENDING)])
        db[Collections.CHUNKS].create_index([("document_id", ASCENDING), ("index", ASCENDING)])
        db[Collections.QUIZZES].create_index("document_id")
        db[Collections.QUIZ_ATTEMPTS].create_index([("user_id", ASCENDING), ("submitted_at", DESCENDING)])
        db[Collections.FLASHCARDS].create_index("document_id")
        db[Collections.MINDMAPS].create_index("document_id")
        db[Collections.CHAT_SESSIONS].create_index([("document_id", ASCENDING), ("user_id", ASCENDING)])
        db[Collections.ROOMS].create_index("room_id", unique=True)
        db[Collections.ROOMS].create_index("room_code")
    except PyMongoError as exc:  # pragma: no cover - only when Mongo is down at boot
        log.warning("Could not create indexes (database unreachable?): %s", exc)


def get_db():
    db = current_app.extensions.get("mongo_db") if current_app else None
    return db if db is not None else _state["db"]


def db_ping() -> str:
    try:
        get_db().command("ping")
        return "connected"
    except Exception as exc:  # noqa: BLE001
        return f"unavailable: {exc.__class__.__name__}"
