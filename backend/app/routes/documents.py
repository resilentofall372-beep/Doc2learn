"""Upload, list, read and delete documents; generate quizzes, flashcards and mind maps."""
from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation, retrieval
from ..services.extract import ExtractionError, extract_text
from ..utils import clamp, clean_str, serialize, to_object_id

bp = Blueprint("documents", __name__)

DIFFICULTIES = {"easy", "medium", "hard"}


def owned_document(document_id: str, projection: dict | None = None) -> dict:
    """Fetch a document and make sure it belongs to the current user."""
    if projection and any(projection.values()):
        projection = {**projection, "user_id": 1}  # inclusion projections must keep the owner field
    doc = get_db()[Collections.DOCUMENTS].find_one({"_id": to_object_id(document_id, "document id")}, projection)
    if not doc:
        raise ApiError("Document not found", 404)
    if doc.get("user_id") != g.user_id:
        raise ApiError("You do not have access to this document", 403)
    return doc


def _summary(doc: dict) -> dict:
    return serialize(
        {
            "_id": doc["_id"],
            "filename": doc.get("filename"),
            "file_type": doc.get("file_type"),
            "file_size": doc.get("file_size"),
            "page_count": doc.get("page_count"),
            "char_count": doc.get("char_count"),
            "chunk_count": doc.get("chunk_count"),
            "uploaded_on": doc.get("uploaded_on"),
            "quiz_count": doc.get("quiz_count", 0),
            "extraction": doc.get("extraction"),
        }
    )


@bp.post("/upload")
@require_auth
def upload():
    if "file" not in request.files:
        raise ApiError("No file provided")
    upload_file = request.files["file"]
    # The file is only ever written to a random temp path, so the original name is
    # kept for display (minus any directory parts); secure_filename guards the extension.
    raw_name = (upload_file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    filename = clean_str(raw_name, 200)
    safe = secure_filename(raw_name)
    if not filename or "." not in safe:
        raise ApiError("The file needs a name with an extension")
    ext = safe.rsplit(".", 1)[1].lower()
    if ext not in current_app.config["ALLOWED_EXTENSIONS"]:
        raise ApiError(f"Unsupported file type .{ext}. Use PDF, DOCX, PPTX, TXT, MD, PNG or JPG.")

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        upload_file.save(tmp.name)
        tmp_path = tmp.name
    try:
        size = os.path.getsize(tmp_path)
        try:
            extracted = extract_text(tmp_path, ext)
        except ExtractionError as exc:
            raise ApiError(str(exc), 422)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    text = extracted.text[: current_app.config["MAX_DOCUMENT_CHARS"]]
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": g.user_id,
        "filename": filename,
        "file_type": ext,
        "file_size": size,
        "extracted_text": text,
        "pages": extracted.pages,
        "page_count": extracted.page_count,
        "char_count": len(text),
        "extraction": {"method": extracted.method, "warnings": extracted.warnings},
        "uploaded_on": now,
        "quiz_count": 0,
    }
    result = get_db()[Collections.DOCUMENTS].insert_one(doc)
    document_id = str(result.inserted_id)

    index_info = retrieval.index_document(document_id, text, extracted.pages)
    get_db()[Collections.DOCUMENTS].update_one(
        {"_id": result.inserted_id},
        {"$set": {"chunk_count": index_info["chunks"], "embedded": index_info["embedded"]}},
    )
    doc["_id"] = result.inserted_id
    doc["chunk_count"] = index_info["chunks"]

    return (
        jsonify(
            {
                "success": True,
                "document_id": document_id,
                "document": _summary(doc),
                "text": text[:500],
                "warnings": extracted.warnings,
            }
        ),
        201,
    )


@bp.get("/")
@require_auth
def list_documents():
    docs = (
        get_db()[Collections.DOCUMENTS]
        .find({"user_id": g.user_id}, {"extracted_text": 0, "pages": 0})
        .sort("uploaded_on", -1)
    )
    return jsonify({"success": True, "documents": [_summary(d) for d in docs]})


@bp.get("/user/<user_id>")
@require_auth
def list_documents_legacy(user_id):  # the id in the URL is ignored; the token decides
    return list_documents()


@bp.get("/<document_id>")
@require_auth
def get_document(document_id):
    doc = owned_document(document_id, {"pages": 0})
    payload = _summary(doc)
    payload["extracted_text"] = doc.get("extracted_text", "")
    return jsonify({"success": True, "document": payload})


@bp.delete("/<document_id>")
@require_auth
def delete_document(document_id):
    doc = owned_document(document_id, {"_id": 1})
    db = get_db()
    db[Collections.DOCUMENTS].delete_one({"_id": doc["_id"]})
    retrieval.delete_index(document_id)
    for name in (
        Collections.QUIZZES,
        Collections.QUIZ_ATTEMPTS,
        Collections.FLASHCARDS,
        Collections.MINDMAPS,
        Collections.CHAT_SESSIONS,
    ):
        db[name].delete_many({"document_id": document_id})
    return jsonify({"success": True, "deleted": document_id})


# --------------------------------------------------------------------------- generation
@bp.post("/generate-quiz")
@require_auth
def generate_quiz():
    data = request.get_json(silent=True) or {}
    document_id = data.get("document_id")
    doc = owned_document(document_id, {"_id": 1, "filename": 1})
    num_questions = clamp(data.get("num_questions"), 1, 25, 5)
    difficulty = data.get("difficulty") if data.get("difficulty") in DIFFICULTIES else "medium"
    focus = clean_str(data.get("focus"), 200) or None

    questions = generation.generate_quiz(document_id, num_questions, difficulty, focus)
    if not questions:
        raise ApiError("The model did not produce usable questions. Try again or lower the count.", 502)

    quiz = {
        "document_id": document_id,
        "user_id": g.user_id,
        "questions": questions,
        "num_questions": len(questions),
        "difficulty": difficulty,
        "focus": focus,
        "model": current_app.config["LLM_MODEL"],
        "created_at": datetime.now(timezone.utc),
    }
    result = get_db()[Collections.QUIZZES].insert_one(quiz)
    get_db()[Collections.DOCUMENTS].update_one({"_id": doc["_id"]}, {"$inc": {"quiz_count": 1}})
    return jsonify(
        {
            "success": True,
            "quiz_id": str(result.inserted_id),
            "document_id": document_id,
            "difficulty": difficulty,
            "questions": questions,
        }
    )


@bp.post("/generate-flashcards")
@require_auth
def generate_flashcards():
    data = request.get_json(silent=True) or {}
    document_id = data.get("document_id")
    owned_document(document_id, {"_id": 1})
    num_cards = clamp(data.get("num_cards"), 3, 30, 10)

    cards = generation.generate_flashcards(document_id, num_cards)
    if not cards:
        raise ApiError("The model did not produce usable flashcards. Try again.", 502)

    get_db()[Collections.FLASHCARDS].insert_one(
        {
            "document_id": document_id,
            "user_id": g.user_id,
            "flashcards": cards,
            "num_cards": len(cards),
            "model": current_app.config["LLM_MODEL"],
            "created_at": datetime.now(timezone.utc),
        }
    )
    return jsonify({"success": True, "flashcards": cards})


@bp.post("/generate-mindmap")
@require_auth
def generate_mindmap():
    data = request.get_json(silent=True) or {}
    document_id = data.get("document_id")
    owned_document(document_id, {"_id": 1})

    mindmap = generation.generate_mindmap(document_id)
    if not mindmap.get("branches"):
        raise ApiError("The model did not produce a usable mind map. Try again.", 502)

    get_db()[Collections.MINDMAPS].update_one(
        {"document_id": document_id, "user_id": g.user_id},
        {
            "$set": {
                "mindmap": mindmap,
                "model": current_app.config["LLM_MODEL"],
                "updated_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    return jsonify({"success": True, "mindmap": mindmap})
