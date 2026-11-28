"""Chunking and retrieval over a project's documents.

Chunks (with page numbers, file names and optional embeddings) live in MongoDB,
so nothing depends on local files. Retrieval is dense (fastembed, ONNX, no
PyTorch) when the model is available and falls back to BM25 keyword scoring.

A *scope* is {"project_id": str, "document_id": str | None}: the whole project,
or one document inside it. Excerpts are labelled `[Doc N, Page P]`, where N is
the document's position in the project (by upload order), and a legend maps
N to the document id and file name so answers can cite real files.
"""
from __future__ import annotations

import logging
import math
import re
import threading
from typing import Iterable

from flask import current_app

from ..extensions import Collections, get_db
from .extract import page_for_offset, section_titles

log = logging.getLogger(__name__)

_embedder_lock = threading.Lock()
_embedder: dict = {"model": None, "failed": False, "name": None}


# --------------------------------------------------------------------------- chunking
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])|\n{2,}")


def chunk_text(text: str, size: int, overlap: int) -> list[dict]:
    """Split text into overlapping chunks that end on sentence boundaries where possible."""
    pieces = [p.strip() for p in _SENTENCE_RE.split(text) if p and p.strip()]
    chunks: list[dict] = []
    buffer: list[str] = []
    buffer_len = 0
    cursor = 0  # absolute offset where the current buffer starts

    def flush(end_offset: int):
        if buffer:
            chunk = " ".join(buffer).strip()
            if chunk:
                chunks.append({"text": chunk, "start": cursor, "end": end_offset})

    search_from = 0
    for piece in pieces:
        start = text.find(piece, search_from)
        if start == -1:
            start = search_from
        search_from = start + len(piece)
        if buffer_len + len(piece) > size and buffer:
            flush(start)
            # keep a tail of the previous chunk as overlap
            tail: list[str] = []
            tail_len = 0
            for sentence in reversed(buffer):
                if tail_len + len(sentence) > overlap:
                    break
                tail.insert(0, sentence)
                tail_len += len(sentence)
            buffer = tail
            buffer_len = tail_len
            cursor = max(start - tail_len, 0)
        if not buffer:
            cursor = start
        buffer.append(piece)
        buffer_len += len(piece)
    flush(len(text))
    return chunks


# --------------------------------------------------------------------------- embeddings
def _load_embedder():
    if not current_app.config["EMBEDDINGS_ENABLED"] or _embedder["failed"]:
        return None
    if _embedder["model"] is not None:
        return _embedder["model"]
    with _embedder_lock:
        if _embedder["model"] is not None:
            return _embedder["model"]
        try:
            from fastembed import TextEmbedding

            name = current_app.config["EMBEDDING_MODEL"]
            # One ONNX thread keeps memory low enough for a 512 MB host; extra
            # threads each get their own buffers and can get the process killed.
            _embedder["model"] = TextEmbedding(model_name=name, threads=1)
            _embedder["name"] = name
            log.info("Loaded embedding model %s", name)
        except Exception as exc:  # noqa: BLE001
            _embedder["failed"] = True
            log.warning("Embeddings unavailable, using keyword retrieval only: %s", exc)
            return None
    return _embedder["model"]


def embed(texts: list[str]) -> list[list[float]] | None:
    model = _load_embedder()
    if model is None or not texts:
        return None
    return [vector.tolist() for vector in model.embed(texts, batch_size=8)]


# --------------------------------------------------------------------------- indexing
def index_document(document_id: str, project_id: str, filename: str, text: str, pages: list[dict]) -> dict:
    cfg = current_app.config
    chunks = chunk_text(text, cfg["CHUNK_SIZE_CHARS"], cfg["CHUNK_OVERLAP_CHARS"])
    vectors = embed([c["text"] for c in chunks])
    titles = section_titles(pages)
    rows = []
    for index, chunk in enumerate(chunks):
        page = page_for_offset(pages, chunk["start"])
        rows.append(
            {
                "document_id": document_id,
                "project_id": project_id,
                "filename": filename,
                "index": index,
                "text": chunk["text"],
                "page": page,
                "section": titles.get(str(page)),
                "embedding": vectors[index] if vectors else None,
            }
        )
    db = get_db()
    db[Collections.CHUNKS].delete_many({"document_id": document_id})
    if rows:
        db[Collections.CHUNKS].insert_many(rows)
    return {"chunks": len(rows), "embedded": vectors is not None}


def delete_index(document_id: str) -> None:
    get_db()[Collections.CHUNKS].delete_many({"document_id": document_id})


# --------------------------------------------------------------------------- scope helpers
def _chunk_filter(scope: dict) -> dict:
    query = {"project_id": scope["project_id"]}
    if scope.get("document_id"):
        query["document_id"] = scope["document_id"]
    elif scope.get("document_ids"):
        query["document_id"] = {"$in": list(scope["document_ids"])}
    return query


def legend_for(project_id: str) -> tuple[dict, dict]:
    """Number the project's documents by upload order.

    Returns (doc_id -> number, legend) where legend is {"1": {"document_id", "filename", "sections"}, ...}.
    `sections` maps a Page number to its section heading for files split at headings
    (Word, Markdown, text), so a citation can name the section. Numbers are stable for the
    whole project, whichever scope is being searched.
    """
    docs = get_db()[Collections.DOCUMENTS].find(
        {"project_id": project_id}, {"filename": 1, "pages.page": 1, "pages.title": 1}
    ).sort("uploaded_on", 1)
    numbers, legend = {}, {}
    for n, doc in enumerate(docs, start=1):
        doc_id = str(doc["_id"])
        numbers[doc_id] = n
        legend[str(n)] = {"document_id": doc_id, "filename": doc.get("filename", f"Document {n}")}
        titles = section_titles(doc.get("pages") or [])
        if titles:
            legend[str(n)]["sections"] = titles
    return numbers, legend


def section_of(legend: dict, doc: int | None, page: int | None) -> str | None:
    """The section heading for [Doc doc, Page page], if that file is split into sections."""
    if doc is None or page is None:
        return None
    return (legend.get(str(doc)) or {}).get("sections", {}).get(str(page))


def _label(row: dict, numbers: dict) -> str:
    n = numbers.get(row["document_id"], "?")
    if row.get("page"):
        label = f"[Doc {n}, Page {row['page']}]"
        return f"{label} (section: {row['section']})" if row.get("section") else label
    return f"[Doc {n}]"


# --------------------------------------------------------------------------- search
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _bm25_scores(query: str, docs: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
    """BM25 with the Lucene IDF form, which never goes negative on small corpora."""
    corpus = [_tokens(d) for d in docs]
    n_docs = len(corpus)
    if not n_docs or not any(corpus):
        return [0.0] * n_docs
    avg_len = sum(len(d) for d in corpus) / n_docs
    doc_freq: dict[str, int] = {}
    for doc in corpus:
        for term in set(doc):
            doc_freq[term] = doc_freq.get(term, 0) + 1
    query_terms = [t for t in _tokens(query) if t in doc_freq]
    scores = []
    for doc in corpus:
        counts: dict[str, int] = {}
        for term in doc:
            counts[term] = counts.get(term, 0) + 1
        length_norm = k1 * (1 - b + b * len(doc) / (avg_len or 1))
        score = 0.0
        for term in query_terms:
            tf = counts.get(term, 0)
            if not tf:
                continue
            idf = math.log(1 + (n_docs - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5))
            score += idf * tf * (k1 + 1) / (tf + length_norm)
        scores.append(score)
    return scores


def _cosine(a: Iterable[float], b: Iterable[float]) -> float:
    dot = norm_a = norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / math.sqrt(norm_a * norm_b)


def search(scope: dict, query: str, top_k: int = 5) -> list[dict]:
    """Most relevant chunks in scope: [{text, page, index, document_id, filename, score}]."""
    rows = list(get_db()[Collections.CHUNKS].find(_chunk_filter(scope)))
    if not rows:
        return []
    texts = [r["text"] for r in rows]

    scores: list[float] | None = None
    if all(r.get("embedding") for r in rows):
        query_vec = embed([query])
        if query_vec:
            scores = [_cosine(query_vec[0], r["embedding"]) for r in rows]
    if scores is None:
        scores = _bm25_scores(query, texts)

    ranked = sorted(range(len(rows)), key=lambda i: scores[i], reverse=True)[:top_k]
    results = []
    for i in ranked:
        if scores[i] <= 0 and len(results) >= 1:
            continue
        row = rows[i]
        results.append(
            {
                "text": row["text"],
                "page": row.get("page"),
                "section": row.get("section"),
                "index": row["index"],
                "document_id": row["document_id"],
                "filename": row.get("filename", ""),
                "score": float(scores[i]),
            }
        )
    return results


def context_for(scope: dict, query: str, max_chars: int = 6000, top_k: int = 6) -> tuple[str, dict, list[dict]]:
    """Citation-friendly excerpts for a question.

    Returns (context, legend, used) where `used` lists {doc, document_id, filename, page}
    for each excerpt included.
    """
    numbers, legend = legend_for(scope["project_id"])
    hits = search(scope, query, top_k=top_k)
    blocks, used, total = [], [], 0
    for hit in hits:
        block = f"{_label(hit, numbers)}\n{hit['text']}"
        if total + len(block) > max_chars:
            break
        blocks.append(block)
        total += len(block)
        ref = {
            "doc": numbers.get(hit["document_id"]),
            "document_id": hit["document_id"],
            "filename": hit["filename"],
            "page": hit.get("page"),
            "section": hit.get("section"),
        }
        if ref not in used:
            used.append(ref)
    return "\n\n".join(blocks), legend, used


def spread_context(scope: dict, max_chars: int = 9000) -> tuple[str, dict]:
    """Excerpts sampled evenly across every document in scope, for generation tasks."""
    numbers, legend = legend_for(scope["project_id"])
    rows = list(
        get_db()[Collections.CHUNKS].find(
            _chunk_filter(scope), {"text": 1, "page": 1, "section": 1, "index": 1, "document_id": 1}
        )
    )
    if not rows:
        return "", legend

    by_doc: dict[str, list[dict]] = {}
    for row in rows:
        by_doc.setdefault(row["document_id"], []).append(row)
    budget = max_chars // max(1, len(by_doc))  # each document gets a fair share

    blocks = []
    for doc_id in sorted(by_doc, key=lambda d: numbers.get(d, 0)):
        doc_rows = sorted(by_doc[doc_id], key=lambda r: r["index"])
        total = sum(len(r["text"]) for r in doc_rows)
        if total <= budget:
            chosen = doc_rows
        else:
            keep = max(1, int(len(doc_rows) * budget / total))
            step = len(doc_rows) / keep
            chosen = [doc_rows[int(i * step)] for i in range(keep)]
        blocks.extend(f"{_label(r, numbers)}\n{r['text']}" for r in chosen)
    return "\n\n".join(blocks)[:max_chars], legend
