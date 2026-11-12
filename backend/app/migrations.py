"""One-off data migrations, run at startup. Each one is idempotent."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from .extensions import Collections

log = logging.getLogger(__name__)

LEGACY_PROJECT_NAME = "My documents"


def move_loose_documents_into_projects(db) -> int:
    """Documents uploaded before projects existed go into a "My documents" project per user.

    Their chunks, quizzes, attempts, flashcards, concept maps and chats follow them.
    Returns the number of documents moved; running again moves nothing.
    """
    loose = {"project_id": {"$exists": False}}
    user_ids = [u for u in db[Collections.DOCUMENTS].distinct("user_id", loose) if u]
    moved = 0
    for user_id in user_ids:
        now = datetime.now(timezone.utc)
        project = db[Collections.PROJECTS].find_one({"user_id": user_id, "migrated": True})
        if project is None:
            project = {
                "user_id": user_id,
                "name": LEGACY_PROJECT_NAME,
                "description": "Documents uploaded before projects were added.",
                "color": "c0",
                "created_at": now,
                "updated_at": now,
                "last_opened_at": None,
                "migrated": True,
            }
            project["_id"] = db[Collections.PROJECTS].insert_one(project).inserted_id
        project_id = str(project["_id"])

        docs = list(db[Collections.DOCUMENTS].find({"user_id": user_id, **loose}, {"_id": 1, "filename": 1}))
        doc_ids = [str(d["_id"]) for d in docs]
        db[Collections.DOCUMENTS].update_many({"user_id": user_id, **loose}, {"$set": {"project_id": project_id}})
        for doc in docs:
            db[Collections.CHUNKS].update_many(
                {"document_id": str(doc["_id"])},
                {"$set": {"project_id": project_id, "filename": doc.get("filename", "")}},
            )
        for name in (Collections.QUIZZES, Collections.QUIZ_ATTEMPTS, Collections.FLASHCARDS, Collections.MINDMAPS, Collections.CHAT_SESSIONS):
            db[name].update_many(
                {"document_id": {"$in": doc_ids}, **loose},
                {"$set": {"project_id": project_id}},
            )
        moved += len(docs)
        log.info("Moved %d document(s) for user %s into project %s", len(docs), user_id, project_id)
    return moved


def run_migrations(db) -> None:
    move_loose_documents_into_projects(db)
