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


def split_single_page_documents(db) -> int:
    """Word and text files uploaded as one big page get split into sections at their headings,
    so citations name a section instead of "p. 1". Chunks keep their text and embeddings; only
    their page and section change. Returns the number of documents split; running again splits
    nothing (they then have more than one page, or no headings to split at).
    """
    from .services.extract import page_for_offset, section_titles, sections_in_place

    split = 0
    candidates = db[Collections.DOCUMENTS].find(
        {"file_type": {"$in": ["docx", "txt", "md"]}, "pages.1": {"$exists": False}, "sections_checked": {"$ne": True}},
        {"extracted_text": 1},
    )
    for doc in candidates:
        text = doc.get("extracted_text") or ""
        pages = sections_in_place(text)
        if not pages:
            db[Collections.DOCUMENTS].update_one({"_id": doc["_id"]}, {"$set": {"sections_checked": True}})
            continue
        titles = section_titles(pages)
        cursor = 0
        for chunk in db[Collections.CHUNKS].find({"document_id": str(doc["_id"])}, {"text": 1}).sort("index", 1):
            at = text.find(chunk["text"][:120], max(0, cursor - 2000))
            if at == -1:
                at = cursor
            cursor = at
            page = page_for_offset(pages, at)
            db[Collections.CHUNKS].update_one({"_id": chunk["_id"]}, {"$set": {"page": page, "section": titles.get(str(page))}})
        db[Collections.DOCUMENTS].update_one(
            {"_id": doc["_id"]},
            {"$set": {"pages": pages, "page_count": len(pages), "sections_checked": True}},
        )
        split += 1
    if split:
        log.info("Split %d single-page document(s) into sections", split)
    return split


def run_migrations(db) -> None:
    move_loose_documents_into_projects(db)
    split_single_page_documents(db)
