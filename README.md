# Doc2Learn

Turn your own study material into a tutor that stays honest.

**Live:** https://doc2learn-sigma.vercel.app (frontend on Vercel, API on Render, data in MongoDB Atlas). The free API sleeps when idle, so the first request after a while can take up to a minute.

Create a **project** for each subject, upload your lecture notes, chapters or slides into it (several files at once, or pasted text), and Doc2Learn gives you:

- **A topic outline** that splits the project into topics in learning order. You can edit it, and it grows as you add documents. Every quiz question and flashcard is labelled with its topic, and each topic has its own quiz and deck.
- **An Overview with a clear next step.** Each topic shows its mastery (from quiz answers and flashcard ratings) and a Learn → Practice → Review → Test path. The page always names the single most useful thing to do now.
- **Spaced repetition.** Rate each flashcard Again / Hard / Good / Easy; it comes back in Review just before you would forget it.
- **A study plan that follows your progress**, saved per project, with today's tasks to tick off. The Projects page has a **Today** panel across all projects.
- **A grounded study tutor** that searches every document in the project, cites the file and page it used, and says plainly when your documents do not cover a question instead of guessing.
- **Quizzes** at three difficulty levels, across the whole project or one document, graded on the server with an explanation and source for every question.
- **Flashcards** and a **concept map**, for the whole project or one document.
- **Summaries, concept explanations, practice problems and a study plan** that weights the areas you have struggled with in past quizzes.
- **Live quiz rooms.** Host a Kahoot-style game from any project; friends join with a six-character code or link, no account needed. The host runs the game (and can remove players) but doesn't play. Rooms are never listed publicly, the invite link expires after 2 hours (the host can make a new one), and expiry never interrupts people already playing.
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
| Fairness in live rooms | Questions are generated and stored on the server, so correct answers never reach any browser (host included) until the quiz ends. Timing is measured on the server, names are unique per room, and only invited people can join. |

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

- **Extraction:** PyMuPDF for PDF (with [Indra](https://github.com/datalab-to/indra) OCR, a small CPU model, for scanned pages), python-docx, python-pptx, and Indra OCR for images. Page boundaries are kept so chunks can cite pages.
- **Retrieval:** sentence-aware overlapping chunks stored in MongoDB with `BAAI/bge-small-en-v1.5` embeddings, searched across a whole project or one document. Excerpts are labelled `[Doc 2, Page 3]`; the API returns a legend so the interface shows the real file name.
- **Generation:** every prompt lives in `backend/app/services/generation.py`, and every model call goes through `backend/app/services/llm.py`. Model output is parsed as JSON and validated before it reaches the browser.
- **Live rooms:** room state is persisted in MongoDB. The host and each player get a private token that every socket event must present. Only the join step checks the invite's expiry; rooms with no activity for 6 hours are closed.

### Accounts and sessions (JWT)

- Passwords are hashed with **bcrypt**; plain passwords are never stored.
- Signing in returns a **JWT** (HS256, signed with `SECRET_KEY` from `.env`) that lasts 24 hours. The browser sends it as `Authorization: Bearer <token>`, and the server checks it on every protected request. The user id always comes from the token, never from the request body.
- **Logging out revokes the session on the server.** Each user has a `token_version`; logging out increments it, so every token issued before that stops working on every device.
- Ownership checks live in one place, `backend/app/access.py` (`owned_project`, `owned_document`, `resolve_scope`).

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
| `rooms` | live quiz rooms: host, players, stored questions, invite code and its expiry |

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

Open a shell on the database with the same address as `MONGO_URI`:

```bash
mongosh "mongodb://localhost:27017/doc2learn"     # or your Atlas mongodb+srv://… string
```

```js
show collections
db.projects.find({}, {name: 1, user_id: 1, updated_at: 1})
db.documents.find({}, {filename: 1, project_id: 1}).limit(10)
db.users.find({}, {password_hash: 0})        // hide password hashes
```

A visual tool such as **MongoDB Compass** or the VS Code MongoDB extension works with the same address.

## Run it locally

You need Python 3.11+, Node 20+, a MongoDB (a local install, or a free Atlas cluster as in *Deploy online* below) and a model API key. The free [Google Gemini](https://aistudio.google.com/apikey) tier works well. OCR of scanned PDFs and images uses Indra (installed by `pip`; its weights download on first use, and the model license is free for personal use and small startups).

```bash
# Backend
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

Open http://localhost:5173.

`LLM_MODEL` picks the model and `LLM_FALLBACK_MODELS` lists models to try when it is busy. `.env.example` shows Gemini, Groq and OpenRouter set-ups.

### Live quizzes with phones and laptops on your Wi-Fi

The Vite dev server already listens on your network. Find your computer's address with `hostname -I` (the first address, e.g. `192.168.1.9`), then add it to `backend/.env`:

```bash
CORS_ORIGINS=http://localhost:5173,http://192.168.1.9:5173
PUBLIC_URL=http://192.168.1.9:5173
```

Restart the backend. The lobby's invite link now uses `PUBLIC_URL`. If your router gives your computer a new address later, update both lines.

## Deploy online (Vercel + Render + MongoDB Atlas)

The React frontend is a static site and runs on **Vercel**. The Flask API can't run on Vercel's serverless functions: live rooms need a long-lived WebSocket, and the server also runs a local OCR model, a local embedding model and model calls of up to three minutes. So the API runs as a Docker service on **Render** (free tier supports WebSockets), and the data lives in **MongoDB Atlas** (free M0 cluster).

```
Browser ─▶ Vercel (React build)
   │
   ├── HTTPS /api ─────────▶ Render (backend/Dockerfile) ─▶ MongoDB Atlas
   └── WebSocket /socket.io ▶        "          "        ─▶ Gemini
```

**1. Database (MongoDB Atlas)**
1. Create a free M0 cluster at https://cloud.mongodb.com.
2. *Database Access*: add a user with a password. *Network Access*: allow `0.0.0.0/0` (Render's free tier has no fixed IP).
3. *Connect → Drivers*: copy the `mongodb+srv://…` string and add `/doc2learn` before the `?`, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/doc2learn?retryWrites=true&w=majority`

**2. API (Render)**
1. Push this repo to GitHub, then on https://render.com: *New → Blueprint* and pick the repo. It reads `render.yaml`.
2. When asked, fill in `MONGO_URI` (step 1), `LLM_API_KEY` (your Gemini key) and `CORS_ORIGINS`. You don't know the Vercel URL yet, so put `http://localhost:5173` for now.
3. When the deploy finishes, open `https://<your-service>.onrender.com/api/health`. It should show `"database": "connected"`.

**3. Frontend (Vercel)**
1. On https://vercel.com: *Add New → Project*, import the repo, set **Root Directory** to `frontend`. Vite is detected automatically, and `frontend/vercel.json` makes page refreshes on routes like `/projects/…` work.
2. Add the environment variables (no trailing slash):
   - `VITE_API_BASE_URL` = `https://<your-service>.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://<your-service>.onrender.com`
3. Deploy, and note the address (e.g. `https://doc2learn.vercel.app`).

**4. Connect them**
On Render, set `CORS_ORIGINS` to your Vercel address (e.g. `https://doc2learn.vercel.app`; separate several with commas) and choose *Save, rebuild and deploy*. The key must be spelled exactly `CORS_ORIGINS` (plural); a trailing slash or quotes in the value are ignored. Leave `PUBLIC_URL` unset: invite links then use the Vercel address automatically.

If sign-in fails with *"blocked by CORS policy … No 'Access-Control-Allow-Origin' header"*, the API doesn't have your Vercel address in `CORS_ORIGINS`: check the key's spelling on Render and redeploy.

Notes:
- `VITE_*` values are baked in at build time. After changing them on Vercel, redeploy.
- Render's free service sleeps after 15 minutes idle, so the first request can take about a minute. Open `/api/health` before a demo to wake it; it also reports whether the database and the model are configured.
- If Render reports running out of memory, set `EMBEDDINGS_ENABLED=false`. Search then falls back to BM25 keyword retrieval.
- Vercel preview deployments get different URLs. Add them to `CORS_ORIGINS` if you want them to work too.

## Shipping changes

Once set up, deploying is just `git push`. Both hosts watch the GitHub repo and rebuild from `main`:

```
your laptop ──git push──▶ GitHub (main)
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
     Vercel (frontend/)                 Render (backend/Dockerfile)
     npm run build, ~1 min              Docker build, ~3–5 min
```

- **Vercel** rebuilds the React app on every push to `main`. Pushes to other branches get a separate preview URL and leave the live site alone.
- **Render** rebuilds the API on every push to `main`. The new version replaces the old one only after `/api/health` passes, so there is no downtime.
- **MongoDB Atlas** is not redeployed. Users, projects and documents stay as they are.

**Routine for a feature**
1. Build and try it locally (`python run.py` + `npm run dev`, see *Run it locally*).
2. Check it: `cd backend && python -m pytest`, then `cd frontend && npm run lint && npm run build`.
3. `git add …`, `git commit -m "…"`, `git push origin main`.
4. Wait for **Ready** in Vercel → Deployments and **Live** in Render → doc2learn-api → Events, then refresh the site.

**What a push does and doesn't deploy**

| You change… | Push is enough? | Otherwise |
| --- | --- | --- |
| Frontend code (`frontend/src`) | Yes, Vercel rebuilds | |
| Backend code (`backend/app`, `requirements.txt`) | Yes, Render rebuilds | |
| A Render env var (`CORS_ORIGINS`, `LLM_API_KEY`, …) | No, it isn't in git | Render → Environment → *Save, rebuild and deploy* |
| A Vercel env var (`VITE_API_BASE_URL`, `VITE_SOCKET_URL`) | No, and it's baked in at build time | Vercel → Settings → Environment Variables, then *Redeploy* |
| Your local `.env` | Never deployed (git-ignored) | Copy new settings to Render by hand |

Good to know:
- If a feature adds a new setting to `backend/app/config.py`, add it in Render too, or the live API uses the default.
- Render rebuilds even for frontend-only pushes. That's harmless, just a few minutes of building.
- A failed build doesn't take the site down: the previous version keeps running. Read the build log in that dashboard.
- To roll back, use *Promote to Production* on an older Vercel deployment and *Rollback* on an older Render deploy, or `git revert` the commit and push.
- `main` goes live on every push, so build bigger features on a branch (`git checkout -b my-feature`) and merge when ready.

## Tests

```bash
cd backend && python -m pytest          # API
cd frontend && npm run lint && npm run build   # frontend
```

The backend suite needs no database or API key. It uses an in-memory MongoDB and a stubbed model, and covers sign-up, login and logout, project privacy, project-wide retrieval, quiz grading, the tutor, the data migration, and a full multiplayer room over Socket.IO.

## Project layout

```
backend/
  app/
    __init__.py    app factory: CORS, Socket.IO, blueprints
    config.py      settings from environment variables
    access.py      ownership checks and project/document scope
    auth.py        JWT sessions
    migrations.py  start-up data migrations
    sockets.py     live room events
    routes/        auth, projects, documents, topics, quiz, flashcards, mindmap, assistant, rooms, stats
    services/      llm (model calls + fallback), extract, retrieval, generation (all prompts),
                   progress (mastery), srs (spaced repetition), rooms
  tests/
  Dockerfile       the image Render builds
frontend/
  src/pages        one file per screen (Projects, Overview, Topics, Quiz, Flashcards, Review, MindMap, Chat, rooms, auth)
  src/components   projects/, document/, assistant/, quiz/, flashcards/, mindmap/, room/, dashboard/, ui/, common/
  src/hooks        useTask (run a request, show an error if it fails), useTopics (project outline)
  src/contexts     auth, notifications, theme, socket
  src/services     api.js (every API call), socket.js, storage.js
  vercel.json      SPA routing on Vercel
render.yaml        Render service for the API
.env.example       settings template (copy to backend/.env)
```

## Roadmap

- A user study comparing cited and uncited tutor answers for how often learners verify, and how accurate they end up.
- Teacher view for live rooms with per-question accuracy, to spot concepts a class finds hard.
- Sharing a project with classmates (read-only), with per-user progress.
