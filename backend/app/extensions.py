"""Shared extension instances: MongoDB handle and Socket.IO server.

Data model (MongoDB, database `doc2learn`):

    users          _id, name, email (unique), password_hash, token_version, created_at
    projects       _id, user_id, name, description, color, created_at, updated_at, last_opened_at
    documents      _id, user_id, project_id, filename, file_type, extracted_text, pages, ...
    chunks         document_id, project_id, filename, index, text, page, embedding
    quizzes        user_id, project_id, document_id|null, questions, difficulty, ...
    quiz_attempts  user_id, project_id, document_id|null, quiz_id, score, percentage, ...
    flashcards     user_id, project_id, document_id|null, flashcards, ...
    mindmaps       user_id, project_id, document_id|null, mindmap
    chat_sessions  user_id, project_id, messages[]
    rooms          room_id, room_code, host_id, project_id, document_id|null, participants[], questions[]

`document_id: null` means "the whole project". Every user-owned row carries
`user_id`, and routes always filter on the signed-in user, so nobody can read
another user's projects.
"""
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
    PROJECTS = "projects"
    DOCUMENTS = "documents"
    CHUNKS = "chunks"
    QUIZZES = "quizzes"
    QUIZ_ATTEMPTS = "quiz_attempts"
    FLASHCARDS = "flashcards"
    MINDMAPS = "mindmaps"
    CHAT_SESSIONS = "chat_sessions"
    ROOMS = "rooms"
    TOPICS = "topics"


# Collections whose rows belong to one project (deleted with it).
PROJECT_CONTENT = (
    Collections.DOCUMENTS,
    Collections.CHUNKS,
    Collections.QUIZZES,
    Collections.QUIZ_ATTEMPTS,
    Collections.FLASHCARDS,
    Collections.MINDMAPS,
    Collections.CHAT_SESSIONS,
    Collections.TOPICS,
)


def init_db(app: Flask, db=None) -> None:
    """Connect to MongoDB (or adopt an injected database for tests)."""
    if db is None:
        client = MongoClient(app.config["MONGO_URI"], serverSelectionTimeoutMS=5000)
        db = client.get_default_database("doc2learn")
        _state["client"] = client
    _state["db"] = db
    app.extensions["mongo_db"] = db
    _ensure_indexes(db)

    from .migrations import run_migrations

    try:
        run_migrations(db)
    except PyMongoError as exc:  # pragma: no cover - only when Mongo is down at boot
        log.warning("Could not run migrations (database unreachable?): %s", exc)


def _ensure_indexes(db) -> None:
    try:
        db[Collections.USERS].create_index("email", unique=True)
        db[Collections.PROJECTS].create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        db[Collections.DOCUMENTS].create_index([("user_id", ASCENDING), ("uploaded_on", DESCENDING)])
        db[Collections.DOCUMENTS].create_index([("project_id", ASCENDING), ("uploaded_on", ASCENDING)])
        db[Collections.CHUNKS].create_index([("document_id", ASCENDING), ("index", ASCENDING)])
        db[Collections.CHUNKS].create_index([("project_id", ASCENDING), ("index", ASCENDING)])
        db[Collections.QUIZZES].create_index("project_id")
        db[Collections.QUIZ_ATTEMPTS].create_index([("user_id", ASCENDING), ("submitted_at", DESCENDING)])
        db[Collections.QUIZ_ATTEMPTS].create_index("project_id")
        db[Collections.FLASHCARDS].create_index([("project_id", ASCENDING), ("document_id", ASCENDING)])
        db[Collections.MINDMAPS].create_index([("project_id", ASCENDING), ("document_id", ASCENDING)])
        db[Collections.CHAT_SESSIONS].create_index([("project_id", ASCENDING), ("user_id", ASCENDING)])
        db[Collections.TOPICS].create_index([("project_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
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
