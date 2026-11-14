# Doc2Learn

Turn your own study material into a tutor that stays honest.

Create a **project** for each subject, upload your lecture notes, chapters or slides into it (several files at once, or pasted text), and Doc2Learn gives you:

- **A topic outline** that splits the project into topics in learning order. You can edit it, and it grows as you add documents. Every quiz question and flashcard is labelled with its topic, and each topic has its own quiz and deck.
- **An Overview with a clear next step.** Each topic shows its mastery (from quiz answers and flashcard ratings) and a Learn → Practice → Review → Test path. The page always names the single most useful thing to do now.
- **Spaced repetition.** Rate each flashcard Again / Hard / Good / Easy; it comes back in Review just before you would forget it.
- **A study plan that follows your progress**, saved per project, with today's tasks to tick off. The Projects page has a **Today** panel across all projects.
- **A grounded study tutor** that searches every document in the project, cites the file and page it used, and says plainly when your documents do not cover a question instead of guessing.
- **Quizzes** at three difficulty levels, across the whole project or one document, graded on the server with an explanation and source for every question.
- **Flashcards** and a **concept map**, for the whole project or one document.
- **Summaries, concept explanations, practice problems and a study plan** that weights the areas you have struggled with in past quizzes.
- **Live quiz rooms.** Host a Kahoot-style game from any project; friends join with a six-character code, no account needed.
- **Real progress stats** per project: quizzes taken, average score, time spent, and the documents you are weakest on.

## Why it is built this way

Learning tools that use language models can be confidently wrong, and students are often poorly placed to notice. The design choices here aim to keep the learner in control of what to trust:

| Concern | What Doc2Learn does |
| --- | --- |
| Hallucinated answers | Retrieval-augmented generation over the learner's own documents only. The system prompt forbids outside facts. |
| Unverifiable claims | Every answer, quiz question and flashcard carries the file and page it came from, so the learner can check the source. |
| Overconfidence | The tutor states when the documents do not contain an answer, and each chat reply is labelled by how well it is grounded. |
| Silent failure | No fake fallback content. If the model is unavailable the user sees a clear error, never placeholder questions presented as real. |
| Privacy | Projects are private to their owner. Every route checks ownership on the server; another user's project is reported as "not found". |
| Fairness in live rooms | Correct answers never leave the server until a question closes, and timing is measured on the server, not the client. |

These are deliberate starting points for studying how learners calibrate trust in AI tutors, for example whether citations change how often students verify an answer, or whether confidence labels reduce over-reliance.

## How it fits together

```
Home page ─▶ Log in / Sign up ─▶ Projects ─▶ a project: Overview · Learn · Practice (Quiz · Flashcards · Review) · Map · Documents

React (Vite, Tailwind)  ──/api──▶  Flask API  ──▶  MongoDB
        │                              │
        └──Socket.IO (live rooms)──────┤
                                       ├──▶  Gemini / any OpenAI-compatible model (with automatic fallback)
                                       └──▶  fastembed (local ONNX embeddings, BM25 fallback)
```

- **Extraction:** PyMuPDF for PDF (with Tesseract OCR for scanned pages), python-docx, python-pptx, and OCR for images. Page boundaries are kept so chunks can cite pages.
- **Retrieval:** sentence-aware overlapping chunks stored in MongoDB with `BAAI/bge-small-en-v1.5` embeddings, searched across a whole project or one document. Excerpts are labelled `[Doc 2, Page 3]`; the API returns a legend so the interface shows the real file name.
- **Generation:** every prompt lives in `backend/app/services/generation.py`, and every model call goes through `backend/app/services/llm.py`. Model output is parsed as JSON and validated before it reaches the browser.
- **Live rooms:** room state is persisted in MongoDB. Each participant gets a private token that every socket event must present.

### Accounts and sessions (JWT)

- Passwords are hashed with **bcrypt**; plain passwords are never stored.
- Signing in returns a **JWT** (HS256, signed with `SECRET_KEY` from `.env`) that lasts 24 hours. The browser sends it as `Authorization: Bearer <token>`, and the server checks it on every protected request. The user id always comes from the token, never from the request body.
- **Logging out revokes the session on the server.** Each user has a `token_version`; logging out increments it, so every token issued before that stops working on every device.
- Ownership checks live in one place, `backend/app/access.py`.

## Database

MongoDB, database `doc2learn`. Every row a user owns carries `user_id`, and project content also carries `project_id`.

| Collection | What it stores |
| --- | --- |
| `users` | name, email (unique), bcrypt `password_hash`, `token_version`, created date |
| `projects` | `user_id`, name, description, colour, created / updated / last opened dates |
| `documents` | `user_id`, `project_id`, file name and type, extracted text with page boundaries, chunk count |
| `chunks` | `project_id`, `document_id`, file name, text, page, embedding (for search) |
| `quizzes`, `quiz_attempts` | generated questions; graded attempts with score and time. `document_id: null` means the whole project |
| `flashcards`, `mindmaps` | generated decks and concept maps, per project or per document (decks also per topic) |
| `topics` | one outline per project: ordered topics (stable `id`, title, summary, key ideas, source pages) and the documents already read into it |
| `card_reviews` | one row per flashcard a learner has rated: a copy of the card, its topic, and its schedule (`ease`, `interval_days`, `due_at`) |
| `study_plans` | the latest whole-project study plan, and which days are done |
| `chat_sessions` | one tutor conversation per user and project |
| `rooms` | live quiz rooms, their players and questions |

```
user ─┬─< project ─┬─< document ─< chunk
      │            ├─< quiz ─< quiz_attempt
      │            ├─< flashcards, mindmaps
      │            ├── topics (outline; questions and cards point at a topic id)
      │            └─< chat_session
      └─< room (as host)
```

Deleting a project deletes everything inside it. Documents uploaded before projects existed are moved into a project called "My documents" automatically the first time the new version starts.

### Looking at the data

With the app running (`docker compose up`):

```bash
# Terminal
docker compose exec mongo mongosh doc2learn
```

```js
show collections
db.projects.find({}, {name: 1, user_id: 1, updated_at: 1})
db.documents.find({}, {filename: 1, project_id: 1}).limit(10)
db.users.find({}, {password_hash: 0})        // hide password hashes
```

For a visual tool such as **MongoDB Compass** or the VS Code MongoDB extension, connect to:

```
mongodb://localhost:27017/doc2learn
```

The port is published to this computer only (`127.0.0.1`), never to your Wi-Fi, because the database has no password.

## Run it

You need Docker and a model API key. The free [Google Gemini](https://aistudio.google.com/apikey) tier works well.

```bash
cp .env.example .env          # then put your key in LLM_API_KEY
docker compose up --build
```

Open http://localhost:8080. MongoDB runs in a container, so nothing else needs installing.

`LLM_MODEL` picks the model and `LLM_FALLBACK_MODELS` lists models to try when it is busy. `.env.example` shows Gemini, Groq and OpenRouter set-ups.

### Live quizzes with phones and laptops on your Wi-Fi

Other devices reach the app through your computer's network address. Find it with `hostname -I` (the first address, e.g. `192.168.1.9`), then add it to `.env`:

```bash
CORS_ORIGINS=http://localhost:8080,http://localhost:5173,http://192.168.1.9:8080
PUBLIC_URL=http://192.168.1.9:8080
```

Restart with `docker compose up --build`. The lobby's invite link now uses `PUBLIC_URL`. If your router gives your computer a new address later, update both lines.

### Without Docker (development)

```bash
# Backend: needs Python 3.11+ and a MongoDB (local, Docker, or Atlas)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env       # set LLM_API_KEY and MONGO_URI
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

The suite needs no database or API key. It uses an in-memory MongoDB and a stubbed model, and covers sign-up, login and logout, project privacy, project-wide retrieval, quiz grading, the tutor, the data migration, and a full multiplayer room over Socket.IO.

## Project layout

```
backend/
  app/
    access.py      ownership checks (projects, documents)
    migrations.py  start-up data migrations
    routes/        auth, projects, documents, topics, quiz, flashcards, mindmap, assistant, rooms, stats
    services/      llm, extract, retrieval, generation, rooms
    sockets.py     live room events
  tests/
frontend/
  src/pages        Home, Login, Signup, Projects, ProjectDocuments, Topics, Chat, Quiz, Flashcards, MindMap, rooms
  src/components   projects/, document/, assistant/, quiz/, flashcards/, mindmap/, room/, ui/, common/
  src/services/api.js
docker-compose.yml
```

## Roadmap

- A user study comparing cited and uncited tutor answers for how often learners verify, and how accurate they end up.
- Teacher view for live rooms with per-question accuracy, to spot concepts a class finds hard.
- Sharing a project with classmates (read-only), with per-user progress.
