"""Upload, paste, read and delete documents in a project; generate quizzes, flashcards and concept maps.

Generation endpoints take `project_id` and an optional `document_id`:
leave the document out to work across the whole project. Quizzes and
flashcards also take an optional `topic_id` from the project's outline.
"""
from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from ..access import owned, owned_document, owned_project, owned_project_id, resolve_scope, scope_ids, touch_project
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation, retrieval
from ..services.extract import ExtractionError, Extracted, extract_text, from_text
from ..utils import clamp, clean_str, serialize
from .topics import drop_document, find_topic, topic_focus, topic_list

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



@bp.post("/upload")
@require_auth
def upload():
    project_id = owned_project_id(request.form.get("project_id"))
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
    return _store(project_id, filename, ext, size, extracted)


@bp.post("/paste")
@require_auth
def paste():
    """Add typed or pasted text (notes without a file) to a project as a .txt document."""
    data = request.get_json(silent=True) or {}
    project = owned_project(data.get("project_id"), {"_id": 1})
    title = clean_str(data.get("title"), 120)
    text = data.get("text") if isinstance(data.get("text"), str) else ""
    if not title:
        raise ApiError("Give the text a title")
    if len(text.strip()) < 20:
        raise ApiError("Paste at least a few sentences")
    filename = title if title.lower().endswith((".txt", ".md")) else f"{title}.txt"
    extracted = from_text(text)
    return _store(str(project["_id"]), filename, "txt", len(text.encode("utf-8")), extracted)


def _store(project_id: str, filename: str, ext: str, size: int, extracted: Extracted):
    """Save an extracted document, index it for retrieval, and return the upload response."""
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


def reader_sections(doc: dict) -> list[dict]:
    """The document as [{page, title, text}] for the reader: one entry per page or section."""
    text = doc.get("extracted_text", "")
    pages = doc.get("pages") or []
    if not pages:
        return [{"page": 1, "title": None, "text": text}] if text else []
    return [{"page": p["page"], "title": p.get("title"), "text": text[p["start"]:p["end"]]} for p in pages]


@bp.get("/<document_id>")
@require_auth
def get_document(document_id):
    """A document with its text, split into pages or sections so the reader can open a citation."""
    doc = owned_document(document_id)
    payload = summary(doc)
    payload["extracted_text"] = doc.get("extracted_text", "")
    payload["sections"] = reader_sections(doc)
    payload["has_sections"] = any(p.get("title") for p in doc.get("pages") or [])
    return jsonify({"success": True, "document": payload})


@bp.delete("/<document_id>")
@require_auth
def delete_document(document_id):
    doc = owned_document(document_id, {"_id": 1, "project_id": 1})
    db = get_db()
    db[Collections.DOCUMENTS].delete_one({"_id": doc["_id"]})
    retrieval.delete_index(document_id)
    # Things generated from just this document go with it; whole-project ones stay.
    for name in (Collections.QUIZZES, Collections.QUIZ_ATTEMPTS, Collections.FLASHCARDS, Collections.MINDMAPS, Collections.CARD_REVIEWS):
        db[name].delete_many({"document_id": document_id, "user_id": g.user_id})
    if doc.get("project_id"):
        drop_document(doc["project_id"], g.user_id, document_id)
        touch_project(doc["project_id"])
    return jsonify({"success": True, "deleted": document_id})


def _topic_args(scope: dict, data: dict) -> tuple[dict | None, list[dict], str | None]:
    """(chosen topic or None, the outline to tag against, focus text) for a generation request."""
    topic = find_topic(scope["project_id"], g.user_id, data.get("topic_id") or None)
    focus = clean_str(data.get("focus"), 200) or None
    if topic:
        focus = topic_focus(topic)
    return topic, topic_list(scope["project_id"], g.user_id), focus


# --------------------------------------------------------------------------- generation
@bp.post("/generate-quiz")
@require_auth
def generate_quiz():
    """Write a quiz. With `quiz_id` (one of your quizzes), add `num_questions` more to it instead:
    the page asks for the first question alone so the learner can start while the rest are written."""
    data = request.get_json(silent=True) or {}
    if data.get("quiz_id"):
        return _extend_quiz(data)
    scope = resolve_scope(data)
    num_questions = clamp(data.get("num_questions"), 1, 25, 5)
    difficulty = data.get("difficulty") if data.get("difficulty") in DIFFICULTIES else "medium"
    topic, topics, focus = _topic_args(scope, data)

    questions = generation.generate_quiz(
        scope_ids(scope), num_questions, difficulty, focus, topics=topics, topic_id=topic["id"] if topic else None
    )
    if not questions:
        raise ApiError("The model did not produce usable questions. Try again or lower the count.", 502)

    db = get_db()
    quiz = {
        **scope_ids(scope),
        "user_id": g.user_id,
        "questions": questions,
        "num_questions": len(questions),
        "difficulty": difficulty,
        "focus": focus,
        "topic_id": topic["id"] if topic else None,
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
            **scope_ids(scope),
            "difficulty": difficulty,
            "topic_id": topic["id"] if topic else None,
            "questions": questions,
        }
    )


def _extend_quiz(data: dict):
    quiz = owned(Collections.QUIZZES, data.get("quiz_id"), "quiz")
    if quiz.get("attempted"):
        raise ApiError("This quiz has already been submitted")
    more = clamp(data.get("num_questions"), 1, 24, 4)
    scope = {"project_id": quiz["project_id"], "document_id": quiz.get("document_id")}
    topics = topic_list(quiz["project_id"], g.user_id)
    questions = generation.generate_quiz(
        scope,
        more,
        quiz.get("difficulty") or "medium",
        quiz.get("focus"),
        topics=topics,
        topic_id=quiz.get("topic_id"),
        avoid=[q["question"] for q in quiz["questions"]],
    )
    asked = {q["question"].strip().lower() for q in quiz["questions"]}
    questions = [q for q in questions if q["question"].strip().lower() not in asked][:more]
    if questions:
        get_db()[Collections.QUIZZES].update_one(
            {"_id": quiz["_id"]}, {"$push": {"questions": {"$each": questions}}, "$inc": {"num_questions": len(questions)}}
        )
    return jsonify({"success": True, "quiz_id": str(quiz["_id"]), "questions": questions})


@bp.post("/generate-flashcards")
@require_auth
def generate_flashcards():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    num_cards = clamp(data.get("num_cards"), 3, 30, 10)
    topic, topics, focus = _topic_args(scope, data)

    cards = generation.generate_flashcards(
        scope_ids(scope), num_cards, focus, topics=topics, topic_id=topic["id"] if topic else None
    )
    if not cards:
        raise ApiError("The model did not produce usable flashcards. Try again.", 502)

    created_at = datetime.now(timezone.utc)
    get_db()[Collections.FLASHCARDS].insert_one(
        {
            **scope_ids(scope),
            "user_id": g.user_id,
            # A deck for one topic is kept separately from the deck for the whole scope.
            "topic_id": topic["id"] if topic else None,
            "flashcards": cards,
            "num_cards": len(cards),
            "model": current_app.config["LLM_MODEL"],
            "created_at": created_at,
        }
    )
    touch_project(scope["project_id"])
    return jsonify({"success": True, "flashcards": cards, "generated_at": created_at.isoformat()})


@bp.post("/generate-mindmap")
@require_auth
def generate_mindmap():
    data = request.get_json(silent=True) or {}
    scope = resolve_scope(data)
    title = scope["project"].get("name", "Project")
    if scope["document_id"]:
        title = owned_document(scope["document_id"], {"filename": 1}).get("filename", title)

    # A whole-project map follows the topic outline, so its branches line up with progress.
    topics = None if scope["document_id"] else topic_list(scope["project_id"], g.user_id) or None
    mindmap = generation.generate_mindmap(scope_ids(scope), title, topics)
    if not mindmap.get("branches"):
        raise ApiError("The model did not produce a usable concept map. Try again.", 502)

    get_db()[Collections.MINDMAPS].update_one(
        {**scope_ids(scope), "user_id": g.user_id},
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
    return jsonify({"success": True, "mindmap": mindmap, "generated_at": datetime.now(timezone.utc).isoformat()})
