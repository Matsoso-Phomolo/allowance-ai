# AllowanceAI

AllowanceAI is a budgeting app for managing a monthly allowance with user accounts, budget categories, expenses, savings, data bundles, mokhatlo savings, food, cosmetics, snacks, reports, alerts, a centralized rule-based decision engine, budget intelligence, and personal planning tools.

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
- `ALLOWANCEAI_ADMIN_EMAILS` optional comma-separated admin emails

Use `FRONTEND_URL` for the deployed frontend URL, for example:

```bash
FRONTEND_URL=https://your-frontend-url.onrender.com
```

### Frontend Render Setup

Create a Render Static Site for the frontend.

- Root directory: `allowanceai/frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

Set this frontend environment variable in Render:

```bash
VITE_API_BASE_URL=https://allowanceai-backend.onrender.com
VITE_APP_VERSION=1.0.5
```

### Android PWA Install

Open the deployed frontend in Android Chrome:

1. Visit `https://allowance-ai.onrender.com`.
2. Tap `Add to Screen` if Chrome shows the native prompt.
3. If Chrome does not show the prompt, tap the three-dot browser menu.
4. Choose `Add to Home screen` or `Install app`.
5. Tap `Add`. AllowanceAI will appear with the phone's app icons and open in standalone app mode.

When AllowanceAI is already running as an installed standalone app, the install/add button is hidden.

### Frontend Auto-Update Versioning

The frontend checks `public/version.json` on app load and every 60 seconds using `cache: "no-store"`. If the deployed `version.json` value is newer or different from the app bundle's `VITE_APP_VERSION`, AllowanceAI shows a small `New update available` banner with a `Reload` button. The app does not auto-refresh while the user is budgeting, editing expenses, adding categories, or using planner tools.

Before each frontend deployment, bump the version in both places:

```bash
# allowanceai/frontend/public/version.json
{ "version": "1.0.6" }

# Render frontend environment variable
VITE_APP_VERSION=1.0.6
```

Also update `DEPLOYMENT_VERSION` in `frontend/public/sw.js` to the same value so the service worker uses a fresh cache name and removes old caches during activation. The service worker caches the app shell, claims clients after activation, deletes old caches, and serves `offline.html` as a friendly fallback if the user opens the app while offline.

### PostgreSQL Notes

- Use Render PostgreSQL or another external PostgreSQL provider.
- Copy the Render PostgreSQL `DATABASE_URL` into the backend environment variables.
- Never commit real database passwords, production database URLs, or production secret keys.
- Keep local secrets in `backend/.env`; configure production secrets inside Render.
- Enable Render PostgreSQL backups from the Render dashboard when available for your plan.
- Before risky production changes, create a manual database backup/export from Render PostgreSQL.
- Keep exported backups private because they contain personal budget and expense data.

### Production Hardening

AllowanceAI uses these production safety controls:

- `ALLOWANCEAI_SECRET_KEY` is required in production. Local development can use a fallback only when not running in a production/Render environment.
- Backend responses include basic security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a minimal `Permissions-Policy`.
- `/health` confirms the API process is running.
- `/ready` checks that the backend can query the database.
- Authenticated users can export their own budgets, categories, expenses, reports, and behavior tracking data as JSON.
- Authenticated users can delete their own account and user-owned data from Profile Settings.
- Users have a `role` field of `user` or `admin`. Existing users default to `user`.
- Admin-only endpoints are protected with 403 responses for normal users.
- Set `ALLOWANCEAI_ADMIN_EMAILS=admin@example.com,owner@example.com` in the backend environment to backfill those existing accounts as admins on startup.
- Admins can view system stats, user lists without password hashes, and admin health/readiness from the Admin Dashboard.

Admin endpoints:

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/health`

To export a user's data locally from the backend:

```bash
cd allowanceai/backend
set EXPORT_USER_EMAIL=you@example.com
python export_user_data.py
```

Optional custom output path:

```bash
set EXPORT_OUTPUT_PATH=my-allowanceai-backup.json
python export_user_data.py
```

### Copy Local Account Data To Render

Local and deployed accounts use different PostgreSQL databases. To use the same account and budget data online, copy the local PostgreSQL rows to the Render PostgreSQL database.

Get the Render PostgreSQL external database URL from the Render dashboard, then run this locally from `allowanceai/backend`:

```bash
set TARGET_DATABASE_URL=postgresql://render-user:render-password@render-host/render-db
set MIGRATE_USER_EMAIL=you@example.com
python migrate_postgres_to_render.py
```

`MIGRATE_USER_EMAIL` is optional. If set, only that account and its budgets, categories, expenses, reports data, and behavior tracking rows are copied. The migration preserves the same hashed password, so the same login should work online after migration.

Do not commit the Render database URL. It is a secret.

## Default New Account Data

When a user registers, AllowanceAI seeds that user with a default monthly budget plus these categories:

- Food: R500
- Snacks: R200
- Cosmetics: R150
- Data Bundles: R250

Use `Data Bundles` for prepaid or provider-neutral data budgets such as Vodacom, MTN, or Econet bundles. You can rename the category to match your provider. Use names such as `Contract Data` or `Monthly Data` for fixed monthly data payments; when those are fully paid, AllowanceAI treats them as paid commitments instead of danger spending.
- Mokhatlo: R200
- Savings: R100
- Emergency: R100
