# AllowanceAI

AllowanceAI is a budgeting app for managing a monthly allowance with user accounts, budget categories, expenses, savings, Econet data, mokhatlo savings, food, cosmetics, snacks, reports, alerts, a centralized rule-based decision engine, budget intelligence, and personal planning tools.

## Tech Stack

- Backend: FastAPI
- Database: PostgreSQL with SQLAlchemy ORM
- Frontend: React + Vite

## Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`.

Create `backend/.env` with local development values:

```bash
DATABASE_URL=postgresql://postgres:your-local-password@localhost:5432/allowanceai
ALLOWANCEAI_SECRET_KEY=replace-with-a-long-random-secret
```

Create the `allowanceai` database in PostgreSQL, then run the backend. To copy existing SQLite data after the PostgreSQL tables exist, use:

```bash
python migrate_sqlite_to_postgres.py
```

Health check:

```bash
http://127.0.0.1:8000/health
```

API docs:

```bash
http://127.0.0.1:8000/docs
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

For local frontend environment setup, copy `frontend/.env.example` to `frontend/.env` if needed:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## API Endpoints

- `GET /`
- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/budget`
- `GET /api/budget`
- `POST /api/categories`
- `GET /api/categories`
- `POST /api/expenses`
- `GET /api/expenses`
- `GET /api/alerts`
- `GET /api/intelligence`
- `POST /api/monthly-plan`
- `POST /api/evaluate-list`
- `GET /api/timetable`
- `POST /api/can-i-buy`

## Render Deployment

### Backend Render Setup

Create a Render Web Service for the backend.

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Runtime file: `backend/runtime.txt`
- Procfile: `backend/Procfile`

Set these backend environment variables in Render:

- `DATABASE_URL`
- `ALLOWANCEAI_SECRET_KEY`
- `FRONTEND_URL`

Use `FRONTEND_URL` for the deployed frontend URL, for example:

```bash
FRONTEND_URL=https://your-frontend-url.onrender.com
```

### Frontend Render Setup

Create a Render Static Site for the frontend.

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

Set this frontend environment variable in Render:

```bash
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

### PostgreSQL Notes

- Use Render PostgreSQL or another external PostgreSQL provider.
- Copy the Render PostgreSQL `DATABASE_URL` into the backend environment variables.
- Never commit real database passwords, production database URLs, or production secret keys.
- Keep local secrets in `backend/.env`; configure production secrets inside Render.

## Default New Account Data

When a user registers, AllowanceAI seeds that user with a default monthly budget plus these categories:

- Food: R500
- Snacks: R200
- Cosmetics: R150
- Econet Data: R250
- Mokhatlo: R200
- Savings: R100
- Emergency: R100
