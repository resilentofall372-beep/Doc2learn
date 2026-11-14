"""A project's topic outline: the ordered list of topics its documents cover.

One row per project in `topics`:
    {project_id, user_id, topics: [{id, title, summary, subtopics, sources}],
     document_ids: [...documents already read into the outline], created_at, updated_at}

Quiz questions and flashcards carry a `topic_id` from this list, so later
features can track progress per topic. Topic ids stay stable when the outline
is updated with new documents or edited by hand; only a full rebuild replaces them.
"""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, g, jsonify, request

from ..access import owned_project, touch_project
from ..auth import require_auth
from ..errors import ApiError
from ..extensions import Collections, get_db
from ..services import generation
from ..utils import clean_str, serialize

bp = Blueprint("topics", __name__)

MAX_TOPICS = 40
MAX_SUBTOPICS = 12


# --------------------------------------------------------------------------- helpers used by other routes
def outline_for(project_id: str, user_id: str) -> dict | None:
    return get_db()[Collections.TOPICS].find_one({"project_id": project_id, "user_id": user_id})


def topic_list(project_id: str, user_id: str) -> list[dict]:
    """The outline's topics, or [] when the project has none yet."""
    row = outline_for(project_id, user_id)
    return row["topics"] if row else []


def find_topic(project_id: str, user_id: str, topic_id: str | None) -> dict | None:
    """The topic with this id, or an error if the id isn't in the project's outline."""
    if not topic_id:
        return None
    for topic in topic_list(project_id, user_id):
        if topic["id"] == topic_id:
            return topic
    raise ApiError("Topic not found in this project", 404)


def topic_focus(topic: dict) -> str:
    """Retrieval query / prompt focus for one topic."""
    subs = ", ".join(topic.get("subtopics") or [])
    return f"{topic['title']} ({subs})" if subs else topic["title"]


def drop_document(project_id: str, user_id: str, document_id: str) -> None:
    """Forget a deleted document: drop its sources, and topics that only came from it."""
    row = outline_for(project_id, user_id)
    if not row:
        return
    kept = []
    for topic in row["topics"]:
        sources = topic.get("sources") or []
        remaining = [s for s in sources if s.get("document_id") != document_id]
        if sources and not remaining:
            continue  # every source was in the deleted document
        kept.append({**topic, "sources": remaining})
    get_db()[Collections.TOPICS].update_one(
        {"_id": row["_id"]},
        {
            "$set": {"topics": kept, "updated_at": datetime.now(timezone.utc)},
            "$pull": {"document_ids": document_id},
        },
    )


# --------------------------------------------------------------------------- internals
def _new_id() -> str:
    return str(ObjectId())


def _source_of(item: dict) -> list[dict]:
    doc = item.get("source_document")
    if not doc:
        return []
    return [{"document_id": doc["document_id"], "filename": doc.get("filename", ""), "page": item.get("source_page")}]


def _merge_subtopics(old: list[str], new: list[str]) -> list[str]:
    seen = {s.lower() for s in old}
    merged = list(old)
    for sub in new:
        if sub.lower() not in seen:
            merged.append(sub)
            seen.add(sub.lower())
    return merged[:MAX_SUBTOPICS]


def _project_documents(project_id: str) -> list[dict]:
    return list(
        get_db()[Collections.DOCUMENTS]
        .find({"project_id": project_id, "user_id": g.user_id}, {"filename": 1, "uploaded_on": 1})
        .sort("uploaded_on", 1)
    )


def _payload(project_id: str, row: dict | None) -> dict:
    docs = _project_documents(project_id)
    covered = set(row.get("document_ids", [])) if row else set()
    pending = [
        {"_id": str(d["_id"]), "filename": d.get("filename", ""), "number": n}
        for n, d in enumerate(docs, start=1)
        if str(d["_id"]) not in covered
    ]
    outline = None
    if row:
        outline = serialize(
            {
                "topics": row["topics"],
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
        )
    return {"success": True, "outline": outline, "pending_documents": pending if row else [], "document_count": len(docs)}


# --------------------------------------------------------------------------- routes
@bp.get("/")
@require_auth
def get_outline():
    """The outline for ?project_id=..., plus documents added since it was built."""
    project = owned_project(request.args.get("project_id"), {"_id": 1})
    project_id = str(project["_id"])
    return jsonify(_payload(project_id, outline_for(project_id, g.user_id)))


@bp.post("/build")
@require_auth
def build():
    """Build the outline, or fold new documents into it.

    mode "update" (default): first time, read every document; afterwards read only
    documents the outline hasn't seen and merge them in, keeping existing topic ids.
    mode "rebuild": start over from every document (topic ids change).
    """
    data = request.get_json(silent=True) or {}
    project = owned_project(data.get("project_id"), {"_id": 1})
    project_id = str(project["_id"])
    mode = "rebuild" if data.get("mode") == "rebuild" else "update"
    db = get_db()
    now = datetime.now(timezone.utc)

    doc_ids = [str(d["_id"]) for d in _project_documents(project_id)]
    if not doc_ids:
        raise ApiError("Add a document to the project first")
    row = outline_for(project_id, g.user_id)

    if row is None or mode == "rebuild":
        generated = generation.generate_outline({"project_id": project_id, "document_id": None})
        if not generated:
            raise ApiError("The model did not produce a usable outline. Try again.", 502)
        topics = [
            {
                "id": _new_id(),
                "title": t["title"],
                "summary": t["summary"],
                "subtopics": t["subtopics"],
                "sources": _source_of(t),
            }
            for t in generated
        ][:MAX_TOPICS]
        db[Collections.TOPICS].update_one(
            {"project_id": project_id, "user_id": g.user_id},
            {
                "$set": {"topics": topics, "document_ids": doc_ids, "updated_at": now},
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
    else:
        covered = set(row.get("document_ids", []))
        new_ids = [d for d in doc_ids if d not in covered]
        if new_ids:
            topics = [dict(t) for t in row["topics"]]
            generated = generation.generate_outline(
                {"project_id": project_id, "document_id": None, "document_ids": new_ids}, existing=topics
            )
            if not generated:
                raise ApiError("The model did not produce a usable outline for the new documents. Try again.", 502)
            for item in generated:
                if item["existing"] is not None:
                    target = topics[item["existing"] - 1]
                    target["subtopics"] = _merge_subtopics(target.get("subtopics") or [], item["subtopics"])
                    target["sources"] = (target.get("sources") or []) + _source_of(item)
                elif len(topics) < MAX_TOPICS:
                    topics.append(
                        {
                            "id": _new_id(),
                            "title": item["title"],
                            "summary": item["summary"],
                            "subtopics": item["subtopics"],
                            "sources": _source_of(item),
                        }
                    )
            db[Collections.TOPICS].update_one(
                {"_id": row["_id"]},
                {"$set": {"topics": topics, "document_ids": sorted(covered | set(new_ids)), "updated_at": now}},
            )
    touch_project(project_id)
    return jsonify(_payload(project_id, outline_for(project_id, g.user_id)))


@bp.put("/")
@require_auth
def save():
    """Save a hand-edited outline: renamed, reordered, added, merged or removed topics.

    Body: {project_id, topics: [{id?, title, summary?, subtopics?}]} in the new order.
    Known ids keep their sources; topics without a known id are new.
    """
    data = request.get_json(silent=True) or {}
    project = owned_project(data.get("project_id"), {"_id": 1})
    project_id = str(project["_id"])
    row = outline_for(project_id, g.user_id)
    if row is None:
        raise ApiError("Build the outline first", 404)
    incoming = data.get("topics")
    if not isinstance(incoming, list):
        raise ApiError("topics must be a list")
    if len(incoming) > MAX_TOPICS:
        raise ApiError(f"An outline can have at most {MAX_TOPICS} topics")

    previous = {t["id"]: t for t in row["topics"]}
    topics, used = [], set()
    for raw in incoming:
        if not isinstance(raw, dict):
            continue
        title = clean_str(raw.get("title"), 80)
        if not title:
            raise ApiError("Every topic needs a title")
        topic_id = raw.get("id") if raw.get("id") in previous and raw.get("id") not in used else _new_id()
        used.add(topic_id)
        subs = raw.get("subtopics") if isinstance(raw.get("subtopics"), list) else []
        sources = raw.get("sources") if isinstance(raw.get("sources"), list) else None
        topics.append(
            {
                "id": topic_id,
                "title": title,
                "summary": clean_str(raw.get("summary"), 300),
                "subtopics": [clean_str(s, 80) for s in subs if clean_str(s, 80)][:MAX_SUBTOPICS],
                # Sources only ever come from documents; a merge may combine two topics' sources.
                "sources": _known_sources(sources, previous) if sources is not None else previous.get(topic_id, {}).get("sources", []),
            }
        )

    get_db()[Collections.TOPICS].update_one(
        {"_id": row["_id"]}, {"$set": {"topics": topics, "updated_at": datetime.now(timezone.utc)}}
    )
    touch_project(project_id)
    return jsonify(_payload(project_id, outline_for(project_id, g.user_id)))


def _known_sources(sources: list, previous: dict) -> list[dict]:
    """Keep only sources that already existed somewhere in the outline (clients can't invent them)."""
    known = {
        (s.get("document_id"), s.get("page")): s
        for topic in previous.values()
        for s in topic.get("sources") or []
    }
    kept = []
    for s in sources:
        if isinstance(s, dict):
            match = known.get((s.get("document_id"), s.get("page")))
            if match and match not in kept:
                kept.append(match)
    return kept
