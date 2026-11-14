"""Every learning artefact the app generates, in one module.

Every function takes a *scope*: {"project_id": str, "document_id": str | None}
(the whole project, or one document in it).

Design rules shared by all prompts:
- Ground everything in retrieved excerpts and ask for citations like [Doc 2, Page 3].
- Tell the model to say when the material does not contain the answer rather
  than inventing one.
- Validate and normalise the model's JSON before it reaches the client.
"""
from __future__ import annotations

import re

from . import retrieval
from .llm import complete, complete_json

SYSTEM_TUTOR = (
    "You are Doc2Learn, a patient study tutor. You only use the provided excerpts from the "
    "learner's own documents. Each excerpt starts with a label like [Doc 2, Page 3]. When you "
    "use an excerpt, cite it with exactly that label in square brackets. If the excerpts do not "
    "contain the answer, say so plainly and suggest what the learner could look for instead. "
    "Never invent facts, citations, documents or page numbers."
)

OPTION_KEYS = ("A", "B", "C", "D")
_CITE_RE = re.compile(r"\[Doc\s*(\d+)(?:\s*,\s*Page\s*(\d+))?\]", re.IGNORECASE)


# --------------------------------------------------------------------------- helpers
def _refs_from(text: str, legend: dict) -> list[dict]:
    """Citations the model actually wrote, resolved to real files."""
    found = []
    for doc, page in _CITE_RE.findall(text):
        entry = legend.get(str(int(doc)))
        if not entry:
            continue  # the model cited a document that isn't in the project
        ref = {"doc": int(doc), "document_id": entry["document_id"], "filename": entry["filename"], "page": int(page) if page else None}
        if ref not in found:
            found.append(ref)
    return found


def _source(raw: dict, legend: dict) -> dict:
    """Normalise a generated item's source fields into {source_document, source_page}."""
    doc = raw.get("source_doc")
    page = raw.get("source_page")
    entry = legend.get(str(int(doc))) if isinstance(doc, (int, float)) else None
    if entry is None and len(legend) == 1:
        entry = next(iter(legend.values()))  # single-document project: no ambiguity
    return {
        "source_document": dict(entry) if entry else None,
        "source_page": int(page) if isinstance(page, (int, float)) else None,
    }


def _strip_fences(text: str) -> str:
    return re.sub(r"^```[a-z]*\n|\n```$", "", text.strip())


def _as_list(value, limit: int) -> list:
    if isinstance(value, list):
        return value[:limit]
    return []


# How the tutor says the documents don't answer the question ("The documents do not contain...",
# "isn't mentioned", "I couldn't find..."), in the many ways a model phrases it.
_NOT_COVERED_RE = re.compile(
    r"\b(?:do|does|did)(?:\s+not|n't)\s+(?:contain|cover|mention|include|discuss|provide|say|address|explain|describe)"
    r"|\b(?:is|are|was|were)(?:\s+not|n't)\s+(?:covered|mentioned|included|discussed|addressed|explained|described)"
    r"|\b(?:cannot|can't|could\s+not|couldn't|unable\s+to)\s+find"
    r"|\bno\s+(?:information|mention|details?)\b"
    r"|\bnot\s+(?:covered|mentioned|discussed)\b"
    r"|\boutside\s+(?:the|your|these)\s+(?:documents?|material|excerpts)",
    re.IGNORECASE,
)


def _confidence(used: list, answer: str, cited: list) -> str:
    # Only judge the opening: a grounded answer may still note a small gap near the end.
    if _NOT_COVERED_RE.search(answer[:400]) and not cited:
        return "low"
    if used and cited:
        return "high"
    return "medium"


def _scope_phrase(scope: dict) -> str:
    return "this document" if scope.get("document_id") else "these documents"


SOURCE_RULE = '- "source_doc" is the Doc number and "source_page" the Page number from the excerpt label the item comes from (integers, or null).'


def _topic_block(topics: list[dict] | None) -> tuple[str, str, str]:
    """Prompt pieces asking the model to tag each item with a topic from the outline.

    Returns (rule, json_field, menu); all empty when there is no outline to tag against.
    """
    if not topics:
        return "", "", ""
    menu = "\n".join(f"{i}. {t['title']}" for i, t in enumerate(topics, start=1))
    rule = '\n- "topic" is the number of the topic (listed below) that the item is about (integer, or null if none fits).'
    return rule, ', "topic": int|null', f"\n\nTopics in this project:\n{menu}"


def _topic_id(raw: dict, topics: list[dict] | None, fixed: str | None) -> str | None:
    """The topic an item belongs to: the requested topic, else the model's pick."""
    if fixed:
        return fixed
    number = raw.get("topic")
    if topics and isinstance(number, (int, float)) and 1 <= int(number) <= len(topics):
        return topics[int(number) - 1]["id"]
    return None


def _focus_line(focus: str | None) -> str:
    return f"\nOnly cover this topic: {focus}." if focus else ""


# --------------------------------------------------------------------------- quiz
def generate_quiz(
    scope: dict,
    num_questions: int,
    difficulty: str,
    focus: str | None = None,
    topics: list[dict] | None = None,
    topic_id: str | None = None,
) -> list[dict]:
    """`topics` is the project outline (to tag questions); `topic_id` pins every question to one topic."""
    if focus:
        context, legend, _ = retrieval.context_for(scope, focus, max_chars=8000, top_k=10)
    else:
        context, legend = retrieval.spread_context(scope)
    guidance = {
        "easy": "recall of definitions and key facts",
        "medium": "understanding and application of the ideas",
        "hard": "analysis, comparison and reasoning across the material",
    }.get(difficulty, "understanding and application of the ideas")

    topic_rule, topic_field, topic_menu = _topic_block(None if topic_id else topics)
    prompt = f"""Write {num_questions} multiple-choice questions from the excerpts below.
Difficulty: {difficulty} ({guidance}).{_focus_line(focus)}

Rules:
- Every question must be answerable from the excerpts alone.
- If the excerpts come from several documents, spread questions across them.
- Exactly four options labelled A-D, all plausible, only one correct. No "all/none of the above".
- Vary which letter is correct.
- "explanation" says why the answer is right and why the distractors are wrong, in 1-3 sentences.
{SOURCE_RULE}{topic_rule}

Return JSON: {{"questions": [{{"question": str, "options": {{"A": str, "B": str, "C": str, "D": str}}, "answer": "A"|"B"|"C"|"D", "explanation": str, "source_doc": int|null, "source_page": int|null{topic_field}}}]}}{topic_menu}

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
        questions.append(
            {
                "question": str(raw["question"]).strip(),
                "options": options,
                "answer": answer,
                "explanation": str(raw.get("explanation", "")).strip(),
                **_source(raw, legend),
                "topic_id": _topic_id(raw, topics, topic_id),
            }
        )
    return questions


# --------------------------------------------------------------------------- flashcards
def generate_flashcards(
    scope: dict,
    num_cards: int,
    focus: str | None = None,
    topics: list[dict] | None = None,
    topic_id: str | None = None,
) -> list[dict]:
    """`topics` is the project outline (to tag cards); `topic_id` pins every card to one topic."""
    if focus:
        context, legend, _ = retrieval.context_for(scope, focus, max_chars=8000, top_k=10)
    else:
        context, legend = retrieval.spread_context(scope)
    topic_rule, topic_field, topic_menu = _topic_block(None if topic_id else topics)
    prompt = f"""Create {num_cards} study flashcards from the excerpts.{_focus_line(focus)}
Cover distinct concepts: definitions, key facts, processes, comparisons.
If the excerpts come from several documents, cover each of them.
"front" is a short question or term; "back" is a precise answer in 1-3 sentences.
{SOURCE_RULE}{topic_rule}

Return JSON: {{"flashcards": [{{"front": str, "back": str, "source_doc": int|null, "source_page": int|null{topic_field}}}]}}{topic_menu}

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.5,
    )
    cards = []
    for raw in _as_list(data.get("flashcards") if isinstance(data, dict) else data, num_cards):
        if isinstance(raw, dict) and raw.get("front") and raw.get("back"):
            cards.append(
                {
                    "front": str(raw["front"]).strip(),
                    "back": str(raw["back"]).strip(),
                    **_source(raw, legend),
                    "topic_id": _topic_id(raw, topics, topic_id),
                }
            )
    return cards


# --------------------------------------------------------------------------- topic outline
def generate_outline(scope: dict, existing: list[dict] | None = None) -> list[dict]:
    """Split the material into an ordered list of study topics.

    `scope` may name several documents ("document_ids"). With `existing` topics (new
    documents joining a project), the model can file new material under one of them
    instead of duplicating it: those items come back with "existing" = that topic's
    1-based number.
    Returns [{"title", "summary", "subtopics", "source_document", "source_page", "existing"}].
    """
    context, legend = retrieval.spread_context(scope, max_chars=12000)
    if not context:
        return []
    if existing:
        menu = "\n".join(f"{i}. {t['title']}" for i, t in enumerate(existing, start=1))
        merge_rule = f"""
The project already has these topics:
{menu}
The excerpts are NEW material. If some of it belongs under one of those topics, return it with
"existing" set to that topic's number, and list only the subtopics it adds. Otherwise create a new
topic with "existing": null. Never repeat an existing topic as a new one."""
    else:
        merge_rule = '\nSet "existing" to null for every topic.'

    prompt = f"""Organise the excerpts into a study outline: the topics a learner should work through,
in a sensible learning order (foundations first).
- 3-12 topics. Each "title" is short (under 8 words) and uses the material's own terminology.
- "summary" says in one sentence what the topic covers.
- "subtopics" lists 2-6 key ideas within it (each under 8 words).
{SOURCE_RULE}{merge_rule}

Return JSON: {{"outline": [{{"title": str, "summary": str, "subtopics": [str, ...], "source_doc": int|null, "source_page": int|null, "existing": int|null}}]}}

Excerpts:
{context}"""
    data = complete_json(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.3,
    )
    topics = []
    for raw in _as_list(data.get("outline") if isinstance(data, dict) else data, 15):
        if not isinstance(raw, dict) or not str(raw.get("title") or "").strip():
            continue
        number = raw.get("existing")
        match = int(number) if existing and isinstance(number, (int, float)) and 1 <= int(number) <= len(existing) else None
        topics.append(
            {
                "title": str(raw["title"]).strip()[:80],
                "summary": str(raw.get("summary") or "").strip()[:300],
                "subtopics": [str(x).strip()[:80] for x in _as_list(raw.get("subtopics"), 8) if str(x).strip()],
                **_source(raw, legend),
                "existing": match,
            }
        )
    return topics


# --------------------------------------------------------------------------- concept map
def generate_mindmap(scope: dict, title: str) -> dict:
    context, _ = retrieval.spread_context(scope, max_chars=7000)
    prompt = f"""Build a concept map of {_scope_phrase(scope)} from the excerpts.
Return JSON: {{"central_topic": str, "branches": [{{"topic": str, "subtopics": [str, ...]}}]}}
Use 3-6 branches with 2-5 short subtopics each (under 8 words). Use the material's own terminology.

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
    return {"central_topic": str(data.get("central_topic") or title).strip(), "branches": branches}


# --------------------------------------------------------------------------- chat
def chat(scope: dict, question: str, history: list[dict]) -> dict:
    context, legend, used = retrieval.context_for(scope, question)
    messages = [{"role": "system", "content": SYSTEM_TUTOR}]
    for turn in history[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"Excerpts from my documents:\n{context or '(no relevant excerpts found)'}\n\nQuestion: {question}",
        }
    )
    answer = complete(messages, temperature=0.3)
    cited = _refs_from(answer, legend)
    confidence = _confidence(used, answer, cited)
    return {
        "answer": answer,
        # When the documents don't answer it, the excerpts that were searched aren't sources.
        "sources": [] if confidence == "low" else cited or used,
        "legend": legend,
        "confidence": confidence,
    }


# --------------------------------------------------------------------------- summaries
def summarize(scope: dict, summary_type: str) -> dict:
    context, legend = retrieval.spread_context(scope, max_chars=10000)
    length = "4-6 sentences" if summary_type == "brief" else "3-5 short paragraphs"
    prompt = f"""Summarise {_scope_phrase(scope)} in {length} for a student revising it.
If there are several documents, say briefly what each one covers.
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
        "legend": legend,
    }


def explain(scope: dict, concept: str) -> dict:
    context, legend, used = retrieval.context_for(scope, concept)
    prompt = f"""Explain "{concept}" to a student using the excerpts.
Structure: one-sentence definition, a plain-language explanation, a concrete example,
and one common misconception. Cite excerpts. If the material does not cover it, say so.

Excerpts:
{context or '(no relevant excerpts found)'}"""
    text = complete(
        [{"role": "system", "content": SYSTEM_TUTOR}, {"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return {
        "concept": concept,
        "explanation": _strip_fences(text),
        "sources": _refs_from(text, legend) or used,
        "legend": legend,
    }


def practice_problems(scope: dict, topic: str, count: int) -> dict:
    if topic and topic.lower() != "general":
        context, legend, _ = retrieval.context_for(scope, topic, max_chars=7000, top_k=8)
    else:
        context, legend = retrieval.spread_context(scope, max_chars=7000)
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
    return {"topic": topic, "problems": problems, "total": len(problems), "legend": legend}


def study_plan(scope: dict, weak_areas: list[str], days: int, performance: dict | None = None) -> dict:
    context, legend = retrieval.spread_context(scope, max_chars=6000)
    weak = ", ".join(weak_areas) if weak_areas else "none reported"
    perf = ""
    if performance:
        perf = (
            f"\nRecent quiz performance: average {performance.get('average_score', 0)}% "
            f"over {performance.get('attempts', 0)} attempt(s)."
        )
    prompt = f"""Create a {days}-day study plan for {_scope_phrase(scope)}.
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
    return {"plan": plan, "duration_days": days, "weak_areas": weak_areas, "legend": legend}
