"""Upload, read and delete documents in a project; generate quizzes, flashcards and concept maps.

Generation endpoints take `project_id` and an optional `document_id`:
leave the document out to work across the whole project.
"""
from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from ..access import owned_document, owned_project, resolve_scope, touch_project
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation, retrieval
from ..services.extract import ExtractionError, extract_text
from ..utils import clamp, clean_str, serialize

bp = Blueprint("documents", __name__)

DIFFICULTIES = {"easy", "medium", "hard"}


def summary(doc: dict, number: int | None = None) -> dict:
    """A document without its text. `number` is its Doc number within the project."""
    return serialize(
        {
            "_id": doc["_id"],
            "project_id": doc.get("project_id"),
            "number": number,
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


def _scope_args(scope: dict) -> dict:
    return {"project_id": scope["project_id"], "document_id": scope["document_id"]}


@bp.post("/upload")
@require_auth
def upload():
    project = owned_project(request.form.get("project_id"), {"_id": 1})
    project_id = str(project["_id"])
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
        "project_id": project_id,
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
    db = get_db()
    result = db[Collections.DOCUMENTS].insert_one(doc)
    document_id = str(result.inserted_id)

    index_info = retrieval.index_document(document_id, project_id, filename, text, extracted.pages)
    db[Collections.DOCUMENTS].update_one(
        {"_id": result.inserted_id},
        {"$set": {"chunk_count": index_info["chunks"], "embedded": index_info["embedded"]}},
    )
    doc["_id"] = result.inserted_id
    doc["chunk_count"] = index_info["chunks"]
    touch_project(project_id)

    number = db[Collections.DOCUMENTS].count_documents({"project_id": project_id})
    return (
        jsonify(
            {
                "success": True,
                "document_id": document_id,
                "document": summary(doc, number=number),
                "warnings": extracted.warnings,
            }
        ),
        201,
    )


@bp.get("/<document_id>")
@require_auth
def get_document(document_id):
    doc = owned_document(document_id, {"pages": 0})
    payload = summary(doc)
    payload["extracted_text"] = doc.get("extracted_text", "")
    return jsonify({"success": True, "document": payload})


@bp.delete("/<document_id>")
@require_auth
def delete_document(document_id):
    doc = owned_document(document_id, {"_id": 1, "project_id": 1})
    db = get_db()
    db[Collections.DOCUMENTS].delete_one({"_id": doc["_id"]})
    retrieval.delete_index(document_id)
    # Things generated from just this document go with it; whole-project ones stay.
    for name in (Collections.QUIZZES, Collections.QUIZ_ATTEMPTS, Collections.FLASHCARDS, Collections.MINDMAPS):
        db[name].delete_many({"document_id": document_id, "user_id": g.user_id})
    if doc.get("project_id"):
        touch_project(doc["project_id"])
    return jsonify({"success": True, "deleted": document_id})


# --------------------------------------------------------------------------- generation
@bp.post("/generate-quiz")
@require_auth
def generate_quiz():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    num_questions = clamp(data.get("num_questions"), 1, 25, 5)
    difficulty = data.get("difficulty") if data.get("difficulty") in DIFFICULTIES else "medium"
    focus = clean_str(data.get("focus"), 200) or None

    questions = generation.generate_quiz(_scope_args(scope), num_questions, difficulty, focus)
    if not questions:
        raise ApiError("The model did not produce usable questions. Try again or lower the count.", 502)

    db = get_db()
    quiz = {
        **_scope_args(scope),
        "user_id": g.user_id,
        "questions": questions,
        "num_questions": len(questions),
        "difficulty": difficulty,
        "focus": focus,
        "model": current_app.config["LLM_MODEL"],
        "created_at": datetime.now(timezone.utc),
    }
    result = db[Collections.QUIZZES].insert_one(quiz)
    if scope["document_id"]:
        db[Collections.DOCUMENTS].update_one({"_id": owned_document(scope["document_id"], {"_id": 1})["_id"]}, {"$inc": {"quiz_count": 1}})
    touch_project(scope["project_id"])
    return jsonify(
        {
            "success": True,
            "quiz_id": str(result.inserted_id),
            **_scope_args(scope),
            "difficulty": difficulty,
            "questions": questions,
        }
    )


@bp.post("/generate-flashcards")
@require_auth
def generate_flashcards():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    num_cards = clamp(data.get("num_cards"), 3, 30, 10)

    cards = generation.generate_flashcards(_scope_args(scope), num_cards)
    if not cards:
        raise ApiError("The model did not produce usable flashcards. Try again.", 502)

    get_db()[Collections.FLASHCARDS].insert_one(
        {
            **_scope_args(scope),
            "user_id": g.user_id,
            "flashcards": cards,
            "num_cards": len(cards),
            "model": current_app.config["LLM_MODEL"],
            "created_at": datetime.now(timezone.utc),
        }
    )
    touch_project(scope["project_id"])
    return jsonify({"success": True, "flashcards": cards})


@bp.post("/generate-mindmap")
@require_auth
def generate_mindmap():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    title = scope["project"].get("name", "Project")
    if scope["document_id"]:
        title = owned_document(scope["document_id"], {"filename": 1}).get("filename", title)

    mindmap = generation.generate_mindmap(_scope_args(scope), title)
    if not mindmap.get("branches"):
        raise ApiError("The model did not produce a usable concept map. Try again.", 502)

    get_db()[Collections.MINDMAPS].update_one(
        {**_scope_args(scope), "user_id": g.user_id},
        {
            "$set": {
                "mindmap": mindmap,
                "model": current_app.config["LLM_MODEL"],
                "updated_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    touch_project(scope["project_id"])
    return jsonify({"success": True, "mindmap": mindmap})
