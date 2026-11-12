"""Every learning artefact the app generates, in one module.

Design rules shared by all prompts:
- Ground everything in retrieved document text and ask for page citations.
- Tell the model to say when the document does not contain the answer rather
  than inventing one.
- Validate and normalise the model's JSON before it reaches the client.
"""
from __future__ import annotations

import re

from . import retrieval
from .llm import complete, complete_json

SYSTEM_TUTOR = (
    "You are Doc2Learn, a patient study tutor. You only use the provided document "
    "excerpts. Each excerpt starts with a label like [Page 3]. When you use an "
    "excerpt, cite its page in square brackets, e.g. [Page 3]. If the excerpts do "
    "not contain the answer, say so plainly and suggest what the learner could look "
    "for instead. Never invent facts, citations, or page numbers."
)

OPTION_KEYS = ("A", "B", "C", "D")


# --------------------------------------------------------------------------- helpers
def _pages_from(text: str) -> list[int]:
    found = []
    for match in re.findall(r"\[Page\s+(\d+)\]", text):
        page = int(match)
        if page not in found:
            found.append(page)
    return found


def _strip_fences(text: str) -> str:
    return re.sub(r"^```[a-z]*\n|\n```$", "", text.strip())


def _as_list(value, limit: int) -> list:
    if isinstance(value, list):
        return value[:limit]
    return []


def _confidence(pages_used: list[int], answer: str) -> str:
    lowered = answer.lower()
    if any(p in lowered for p in ("does not contain", "doesn't contain", "not covered", "cannot find", "no information")):
        return "low"
    if pages_used and _pages_from(answer):
        return "high"
    return "medium"


# --------------------------------------------------------------------------- quiz
def generate_quiz(document_id: str, num_questions: int, difficulty: str, focus: str | None = None) -> list[dict]:
    context = (
        retrieval.context_for(document_id, focus, max_chars=8000, top_k=10)[0]
        if focus
        else retrieval.spread_context(document_id)
    )
    guidance = {
        "easy": "recall of definitions and key facts",
        "medium": "understanding and application of the ideas",
        "hard": "analysis, comparison and reasoning across the material",
    }.get(difficulty, "understanding and application of the ideas")

    prompt = f"""Write {num_questions} multiple-choice questions from the excerpts below.
Difficulty: {difficulty} ({guidance}).

Rules:
- Every question must be answerable from the excerpts alone.
- Exactly four options labelled A-D, all plausible, only one correct. No "all/none of the above".
- Vary which letter is correct.
- "explanation" says why the answer is right and why the distractors are wrong, in 1-3 sentences.
- "source_page" is the page label the question comes from (integer) or null.

Return JSON: {{"questions": [{{"question": str, "options": {{"A": str, "B": str, "C": str, "D": str}}, "answer": "A"|"B"|"C"|"D", "explanation": str, "source_page": int|null}}]}}

Excerpts:
{context}"""

    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.5,
    )
    questions = []
    for raw in _as_list(data.get("questions") if isinstance(data, dict) else data, num_questions):
        if not isinstance(raw, dict):
            continue
        options = raw.get("options")
        if isinstance(options, list):
            options = dict(zip(OPTION_KEYS, options))
        if not isinstance(options, dict):
            continue
        options = {k: str(options.get(k, "")).strip() for k in OPTION_KEYS}
        answer = str(raw.get("answer", "")).strip().upper()[:1]
        if answer not in OPTION_KEYS or not all(options.values()) or not raw.get("question"):
            continue
        page = raw.get("source_page")
        questions.append(
            {
                "question": str(raw["question"]).strip(),
                "options": options,
                "answer": answer,
                "explanation": str(raw.get("explanation", "")).strip(),
                "source_page": int(page) if isinstance(page, (int, float)) else None,
            }
        )
    return questions


# --------------------------------------------------------------------------- flashcards
def generate_flashcards(document_id: str, num_cards: int) -> list[dict]:
    context = retrieval.spread_context(document_id)
    prompt = f"""Create {num_cards} study flashcards from the excerpts.
Cover distinct concepts: definitions, key facts, processes, comparisons.
"front" is a short question or term; "back" is a precise answer in 1-3 sentences.
Include "source_page" (integer or null).

Return JSON: {{"flashcards": [{{"front": str, "back": str, "source_page": int|null}}]}}

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.5,
    )
    cards = []
    for raw in _as_list(data.get("flashcards") if isinstance(data, dict) else data, num_cards):
        if isinstance(raw, dict) and raw.get("front") and raw.get("back"):
            page = raw.get("source_page")
            cards.append(
                {
                    "front": str(raw["front"]).strip(),
                    "back": str(raw["back"]).strip(),
                    "source_page": int(page) if isinstance(page, (int, float)) else None,
                }
            )
    return cards


# --------------------------------------------------------------------------- mind map
def generate_mindmap(document_id: str) -> dict:
    context = retrieval.spread_context(document_id, max_chars=7000)
    prompt = f"""Build a concept mind map of the excerpts.
Return JSON: {{"central_topic": str, "branches": [{{"topic": str, "subtopics": [str, ...]}}]}}
Use 3-6 branches with 2-5 short subtopics each (under 8 words). Use the document's own terminology.

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.4,
    )
    if not isinstance(data, dict):
        data = {}
    branches = []
    for raw in _as_list(data.get("branches"), 8):
        if isinstance(raw, dict) and raw.get("topic"):
            subs = [str(s).strip() for s in _as_list(raw.get("subtopics"), 6) if str(s).strip()]
            branches.append({"topic": str(raw["topic"]).strip(), "subtopics": subs})
    return {"central_topic": str(data.get("central_topic", "Document")).strip(), "branches": branches}


# --------------------------------------------------------------------------- chat
def chat(document_id: str, question: str, history: list[dict]) -> dict:
    context, pages = retrieval.context_for(document_id, question)
    messages = [{"role": "system", "content": SYSTEM_TUTOR}]
    for turn in history[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"Document excerpts:\n{context or '(no relevant excerpts found)'}\n\nQuestion: {question}",
        }
    )
    answer = complete(messages, temperature=0.3)
    cited = _pages_from(answer) or pages
    return {"answer": answer, "sources": cited, "confidence": _confidence(pages, answer)}


# --------------------------------------------------------------------------- summaries
def summarize(document_id: str, summary_type: str) -> dict:
    context = retrieval.spread_context(document_id, max_chars=10000)
    length = "4-6 sentences" if summary_type == "brief" else "3-5 short paragraphs"
    prompt = f"""Summarise the document excerpts in {length} for a student revising it.
Then list the 4-6 most important points.
Return JSON: {{"summary": str, "key_points": [str, ...]}}

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.3,
    )
    if not isinstance(data, dict):
        data = {"summary": str(data)}
    return {
        "summary": str(data.get("summary", "")).strip(),
        "key_points": [str(p).strip() for p in _as_list(data.get("key_points"), 8)],
        "summary_type": summary_type,
    }


def explain(document_id: str, concept: str) -> dict:
    context, pages = retrieval.context_for(document_id, concept)
    prompt = f"""Explain "{concept}" to a student using the excerpts.
Structure: one-sentence definition, a plain-language explanation, a concrete example,
and one common misconception. Cite pages. If the document does not cover it, say so.

Excerpts:
{context or '(no relevant excerpts found)'}"""
    text = complete(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return {"concept": concept, "explanation": _strip_fences(text), "sources": _pages_from(text) or pages}


def practice_problems(document_id: str, topic: str, count: int) -> dict:
    context = (
        retrieval.context_for(document_id, topic, max_chars=7000, top_k=8)[0]
        if topic and topic.lower() != "general"
        else retrieval.spread_context(document_id, max_chars=7000)
    )
    prompt = f"""Write {count} open-ended practice problems on "{topic}" from the excerpts.
Each has "question", a "hint" that nudges without giving it away, and a model "answer".
Return JSON: {{"problems": [{{"question": str, "hint": str, "answer": str}}]}}

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.5,
    )
    problems = []
    for raw in _as_list(data.get("problems") if isinstance(data, dict) else data, count):
        if isinstance(raw, dict) and raw.get("question"):
            problems.append(
                {
                    "question": str(raw["question"]).strip(),
                    "hint": str(raw.get("hint", "")).strip(),
                    "answer": str(raw.get("answer", "")).strip(),
                }
            )
    return {"topic": topic, "problems": problems, "total": len(problems)}


def study_plan(document_id: str, weak_areas: list[str], days: int, performance: dict | None = None) -> dict:
    context = retrieval.spread_context(document_id, max_chars=6000)
    weak = ", ".join(weak_areas) if weak_areas else "none reported"
    perf = ""
    if performance:
        perf = (
            f"\nRecent quiz performance on this document: average {performance.get('average_score', 0)}% "
            f"over {performance.get('attempts', 0)} attempt(s)."
        )
    prompt = f"""Create a {days}-day study plan for this document.
Learner's self-reported weak areas: {weak}.{perf}
Spend more time on weak areas, interleave review, and keep each day to 3-4 concrete activities
(each under 15 words). Finish with a review day.
Return JSON: {{"plan": [{{"day": int, "topic": str, "activities": [str, ...]}}]}}

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.4,
    )
    plan = []
    for i, raw in enumerate(_as_list(data.get("plan") if isinstance(data, dict) else data, days), start=1):
        if isinstance(raw, dict):
            plan.append(
                {
                    "day": int(raw.get("day") or i),
                    "topic": str(raw.get("topic", f"Day {i}")).strip(),
                    "activities": [str(a).strip() for a in _as_list(raw.get("activities"), 6)],
                }
            )
    return {"plan": plan, "duration_days": days, "weak_areas": weak_areas}
