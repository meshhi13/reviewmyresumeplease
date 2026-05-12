# reviewmyresumeplease

## What is included

- `frontend/`: React + TypeScript app for auth, uploading resumes, viewing PDFs, inline review workflows, and profile/browse pages.
- `backend/`: FastAPI API with authentication, resume/comment/review endpoints, and Postgres persistence.
- `db`: Postgres database for users, resumes, comments, review status, and metadata.

## Core workflow

1. Upload a resume (PDF and LaTeX-supported workflow in the app).
2. Reviewers leave issues/suggestions on specific resume sections.
3. Upload revisions tied to prior issues.
4. Track open vs resolved comments.

Redaction controls:

- Click a word to redact that word.
- Ctrl+click or Cmd+click a word to redact its line.
- Drag to create a custom redaction box.

## Landing page demos

The landing page includes 3 embedded demo videos served from `frontend/public/`:

- `demo1.mp4`
- `demo2.mp4`
- `demo3.mp4`

These are rendered in the demos section of `frontend/src/components/LandingPage.tsx`.

## Run with Docker Compose

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/health`
- Postgres: `localhost:5432`

## Run frontend locally

```bash
cd frontend
npm install
npm run dev
```

## Run backend locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

For backend development outside Docker, make sure Postgres is running and `DATABASE_URL` is set.
