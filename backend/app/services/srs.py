"""Spaced repetition for flashcards: a small SM-2 variant.

Each reviewed card keeps {ease, interval_days, reps, lapses, due_at}. The learner rates a
card after flipping it; the rating decides when it comes back:

- again: forgot it. Back in 10 minutes; ease drops; the run of successful reviews resets.
- hard:  remembered with effort. Interval grows a little; ease drops slightly.
- good:  remembered. 1 day, then 3 days, then interval x ease.
- easy:  effortless. Longer than good, and ease rises.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta

RATINGS = ("again", "hard", "good", "easy")
MIN_EASE = 1.3
MAX_INTERVAL_DAYS = 365


def card_key(card: dict) -> str:
    """Stable id for a card: its own id, or a hash of its text for decks made before ids existed."""
    if card.get("id"):
        return str(card["id"])
    text = f"{card.get('front', '').strip()}\n{card.get('back', '').strip()}"
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def schedule(state: dict | None, rating: str, now: datetime) -> dict:
    """The card's next state after a review with `rating` at `now`."""
    state = state or {}
    ease = float(state.get("ease", 2.5))
    interval = float(state.get("interval_days", 0))
    reps = int(state.get("reps", 0))
    lapses = int(state.get("lapses", 0))

    if rating == "again":
        reps, lapses = 0, lapses + 1
        ease = max(MIN_EASE, ease - 0.2)
        interval = 0
        due = now + timedelta(minutes=10)
    else:
        if rating == "hard":
            ease = max(MIN_EASE, ease - 0.15)
            interval = max(1, interval * 1.2) if interval else 1
        elif rating == "good":
            interval = 1 if reps == 0 else 3 if reps == 1 else interval * ease
        else:  # easy
            interval = 3 if reps == 0 else max(interval, 1) * ease * 1.3
            ease += 0.15
        reps += 1
        interval = min(MAX_INTERVAL_DAYS, max(1, round(interval)))
        due = now + timedelta(days=interval)

    return {
        "ease": round(ease, 2),
        "interval_days": interval,
        "reps": reps,
        "lapses": lapses,
        "due_at": due,
        "last_rating": rating,
        "last_reviewed_at": now,
    }
