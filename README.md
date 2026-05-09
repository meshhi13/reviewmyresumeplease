# ResumeReviewPlatform

Minimal MVP sketch for a reviewmyresumeplease platform.

## What is included

- `frontend/`: React + TypeScript app with separate sign-in/create-account flows, PDF upload, optional anonymization, profile saves, and saved resume reloads.
- `backend/`: FastAPI API with password-hashed account creation, sign-in, bearer sessions, and Postgres-backed resume storage.
- `db`: Postgres for users, uploaded PDFs, notes, review status, and saved redaction metadata.

Redaction controls:

- Click a word to black out that word.
- Ctrl+click or Cmd+click a word to black out its line.
- Drag over any area to create a custom redaction box.

## Run with Docker Compose

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/health`
- Postgres: `localhost:5432`

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

For local backend development outside Docker, make sure Postgres is running and set `DATABASE_URL` if it is not available at `postgresql+psycopg://resume:resume@localhost:5432/resume_review`.
