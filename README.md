# Doc2Learn

Turn your own study material into a tutor that stays honest.

Upload lecture notes, a textbook chapter or slides. Doc2Learn indexes them and gives you:

- **A grounded study tutor.** It answers only from your document, cites the pages it used, and says plainly when the document does not cover a question instead of guessing.
- **Quizzes** at three difficulty levels, optionally focused on a topic, graded on the server with an explanation and source page for every question.
- **Flashcards** and a **concept mind map** generated from the document.
- **Summaries, concept explanations, practice problems and a study plan** that weights the areas you have struggled with in past quizzes.
- **Live quiz rooms.** Host a Kahoot-style game from any document; friends join with a six-character code, no account needed.
- **A dashboard built from real activity:** quiz count, average score, time spent, and the documents you are weakest on.

## Why it is built this way

Learning tools that use language models can be confidently wrong, and students are often poorly placed to notice. The design choices here aim to keep the learner in control of what to trust:

| Concern | What Doc2Learn does |
| --- | --- |
| Hallucinated answers | Retrieval-augmented generation over the learner's own document only. The system prompt forbids outside facts. |
| Unverifiable claims | Every answer, quiz question and flashcard carries the page it came from, so the learner can check the source. |
| Overconfidence | The tutor states when the document does not contain an answer, and each chat reply is labelled high, medium or low confidence. |
| Silent failure | No fake fallback content. If the model is unavailable the user sees a clear error, never placeholder questions presented as real. |
| Privacy | Documents are private to their owner. Every route checks ownership on the server; the client never chooses whose data it reads. |
| Fairness in live rooms | Correct answers never leave the server until a question closes, and timing is measured on the server, not the client. |

These are deliberate starting points for studying how learners calibrate trust in AI tutors, for example whether page citations change how often students verify an answer, or whether confidence labels reduce over-reliance.

## Architecture

```
React (Vite, Tailwind)  ──/api──▶  Flask API  ──▶  MongoDB
        │                              │             users, documents, chunks + embeddings,
        └──Socket.IO (live rooms)──────┤             quizzes, attempts, chat sessions, rooms
                                       │
                                       ├──▶  OpenRouter (any chat model, one config value)
                                       └──▶  fastembed (local ONNX embeddings, BM25 fallback)
```

- **Extraction:** PyMuPDF for PDF (with Tesseract OCR for scanned pages), python-docx, python-pptx, and OCR for images. Page boundaries are kept so chunks can cite pages.
- **Retrieval:** sentence-aware overlapping chunks stored in MongoDB with `BAAI/bge-small-en-v1.5` embeddings. If the embedding model is unavailable, retrieval falls back to BM25 keyword scoring automatically.
- **Generation:** every prompt lives in `backend/app/services/generation.py`, and every model call goes through `backend/app/services/llm.py`. Model output is parsed as JSON and validated before it reaches the browser.
- **Auth:** email and password, bcrypt hashes, JWT bearer tokens.
- **Live rooms:** room state is persisted in MongoDB. Each participant gets a private token that every socket event must present, so nobody can act as the host or as another player.

## Run it

You need Docker and an [OpenRouter API key](https://openrouter.ai/keys).

```bash
cp .env.example .env          # then put your key in OPENROUTER_API_KEY
docker compose up --build
```

Open http://localhost:8080. MongoDB runs in a container, so nothing else needs installing.

To use a different model, set `LLM_MODEL` in `.env` to any OpenRouter model id, such as `anthropic/claude-3.5-haiku` or `google/gemini-2.0-flash-001`.

### Without Docker (development)

```bash
# Backend: needs Python 3.11+ and a MongoDB (local, Docker, or Atlas)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # set OPENROUTER_API_KEY and MONGO_URI
python run.py                 # http://localhost:5000/api/health

# Frontend, in another terminal
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to the backend
```

## Tests

```bash
cd backend && python -m pytest
```

The suite needs no database or API key. It uses an in-memory MongoDB and a stubbed model, and covers auth, document ownership, retrieval, quiz grading, the tutor, and a full multiplayer room over Socket.IO.

## Project layout

```
backend/
  app/
    routes/        auth, documents, quiz, flashcards, mindmap, assistant, rooms, stats
    services/      llm (OpenRouter), extract, retrieval, generation, rooms
    sockets.py     live room events
  tests/
frontend/
  src/pages, src/components, src/services/api.js
docker-compose.yml
```

## Roadmap

- A user study comparing cited and uncited tutor answers for how often learners verify, and how accurate they end up.
- Spaced repetition scheduling for flashcards, based on the known and unknown marks learners already give.
- Teacher view for live rooms with per-question accuracy, to spot concepts a class finds hard.
- Accessibility pass: full keyboard play in live rooms, and screen-reader labels on the mind map.
