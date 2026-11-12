"""Chunking and retrieval over a document's text.

Chunks (with page numbers and optional embeddings) live in MongoDB, so nothing
depends on local files. Retrieval is dense (fastembed, ONNX, no PyTorch) when
the model is available and falls back to BM25 keyword scoring otherwise.
"""
from __future__ import annotations

import logging
import math
import re
import threading
from typing import Iterable

from flask import current_app

from ..extensions import Collections, get_db
from .extract import page_for_offset

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
            _embedder["model"] = TextEmbedding(model_name=name)
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
    return [vector.tolist() for vector in model.embed(texts, batch_size=32)]


def embeddings_status() -> dict:
    return {
        "enabled": bool(current_app.config["EMBEDDINGS_ENABLED"]),
        "loaded": _embedder["model"] is not None,
        "model": _embedder["name"] or current_app.config["EMBEDDING_MODEL"],
        "fallback": "bm25",
    }


# --------------------------------------------------------------------------- indexing
def index_document(document_id: str, text: str, pages: list[dict]) -> dict:
    cfg = current_app.config
    chunks = chunk_text(text, cfg["CHUNK_SIZE_CHARS"], cfg["CHUNK_OVERLAP_CHARS"])
    vectors = embed([c["text"] for c in chunks])
    rows = []
    for index, chunk in enumerate(chunks):
        rows.append(
            {
                "document_id": document_id,
                "index": index,
                "text": chunk["text"],
                "page": page_for_offset(pages, chunk["start"]),
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


def search(document_id: str, query: str, top_k: int = 5) -> list[dict]:
    """Return the most relevant chunks: [{text, page, index, score}]."""
    rows = list(
        get_db()[Collections.CHUNKS].find({"document_id": document_id}).sort("index", 1)
    )
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
        results.append(
            {
                "text": rows[i]["text"],
                "page": rows[i].get("page"),
                "index": rows[i]["index"],
                "score": float(scores[i]),
            }
        )
    return results


def context_for(document_id: str, query: str, max_chars: int = 6000, top_k: int = 6) -> tuple[str, list[int]]:
    """Build a citation-friendly context block and return it with the pages used."""
    hits = search(document_id, query, top_k=top_k)
    blocks, pages, used = [], [], 0
    for hit in hits:
        label = f"[Page {hit['page']}]" if hit.get("page") else f"[Section {hit['index'] + 1}]"
        block = f"{label}\n{hit['text']}"
        if used + len(block) > max_chars:
            break
        blocks.append(block)
        used += len(block)
        if hit.get("page") and hit["page"] not in pages:
            pages.append(hit["page"])
    return "\n\n".join(blocks), pages


def spread_context(document_id: str, max_chars: int = 9000) -> str:
    """Evenly sampled chunks across the whole document, for generation tasks."""
    rows = list(
        get_db()[Collections.CHUNKS].find({"document_id": document_id}, {"text": 1, "page": 1, "index": 1}).sort("index", 1)
    )
    if not rows:
        return ""
    total = sum(len(r["text"]) for r in rows)
    if total <= max_chars:
        chosen = rows
    else:
        keep = max(1, int(len(rows) * max_chars / total))
        step = len(rows) / keep
        chosen = [rows[int(i * step)] for i in range(keep)]
    blocks = []
    for r in chosen:
        label = f"[Page {r['page']}]" if r.get("page") else f"[Section {r['index'] + 1}]"
        blocks.append(f"{label}\n{r['text']}")
    return "\n\n".join(blocks)[:max_chars]
