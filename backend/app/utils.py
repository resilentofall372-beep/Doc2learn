"""Small helpers shared by routes."""
from __future__ import annotations

import random
from datetime import datetime, timezone

from bson import ObjectId

from .errors import ApiError


def to_object_id(value: str, label: str = "id") -> ObjectId:
    if not value or not ObjectId.is_valid(value):
        raise ApiError(f"Invalid {label}", 400)
    return ObjectId(value)


def serialize(doc):
    """Recursively convert ObjectId and datetime values into JSON-safe types."""
    if isinstance(doc, list):
        return [serialize(item) for item in doc]
    if isinstance(doc, dict):
        return {key: serialize(value) for key, value in doc.items()}
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


def random_code(length: int = 6) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I ambiguity
    return "".join(random.choices(alphabet, k=length))


def clamp(value, low, high, default):
    try:
        value = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, value))


def clean_str(value, max_len: int = 200, default: str = "") -> str:
    if not isinstance(value, str):
        return default
    value = "".join(ch for ch in value if ch.isprintable()).strip()
    return value[:max_len] or default


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    """PyMongo returns naive datetimes that are UTC; make them timezone-aware."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
