# AllowanceAI

AllowanceAI is a budgeting app for managing a monthly allowance with user accounts, budget categories, expenses, savings, data bundles, mokhatlo savings, food, cosmetics, snacks, reports, alerts, in-app notifications, saved shopping lists, budget intelligence, monthly insights, admin tools, and a rule-based decision engine.

## Tech Stack

- Backend: FastAPI
- Database: PostgreSQL with SQLAlchemy ORM
- Frontend: React + Vite
- Deployment: Render backend, Vercel frontend

## Public URLs

- Backend public URL: `https://allowanceai-backend.onrender.com`
- Frontend public URL: `https://your-vercel-frontend-url.vercel.app`

After deploying the frontend to Vercel, update the backend `FRONTEND_URL` environment variable to the real Vercel URL so CORS allows browser requests.

## Local Development

### Backend

```bash
cd allowanceai/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Local backend URL:

```text
http://127.0.0.1:8000
```

Create `allowanceai/backend/.env` for local secrets:

```bash
DATABASE_URL=postgresql://postgres:your-local-password@localhost:5432/allowanceai
ALLOWANCEAI_SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_URL=http://127.0.0.1:5173
```

Create the local PostgreSQL database first. To copy old SQLite data after PostgreSQL tables exist:

```bash
python migrate_sqlite_to_postgres.py
```

Useful local backend URLs:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/ready
http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd allowanceai/frontend
npm install
npm run dev
```

Local frontend URL:

```text
http://127.0.0.1:5173
```

For local frontend environment setup, copy `allowanceai/frontend/.env.example` to `allowanceai/frontend/.env` if needed:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_APP_VERSION=1.0.7
```

## Backend on Render

Create a Render Web Service for the backend.

- Root Directory: `allowanceai/backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port 10000`

Required environment variables:

- `DATABASE_URL`
- `ALLOWANCEAI_SECRET_KEY`
- `FRONTEND_URL`
- `PYTHON_VERSION=3.11.9`

Optional environment variable:

- `ALLOWANCEAI_ADMIN_EMAILS`

Health checks:

- `https://allowanceai-backend.onrender.com/health`
- `https://allowanceai-backend.onrender.com/ready`

Render deployment notes:

- Use Render PostgreSQL or another external PostgreSQL provider.
- Copy the Render PostgreSQL `DATABASE_URL` into the backend environment variables.
- Never commit production database URLs, passwords, or secret keys.
- Keep local secrets in `allowanceai/backend/.env`.
- Configure production secrets inside Render.
- Enable Render PostgreSQL backups from the Render dashboard when available.

## Frontend on Vercel

Create a Vercel project for the frontend.

- Root Directory: `allowanceai/frontend`
- Framework: `Vite`
- Build Command: `npm install && npm run build`
- Output Directory: `dist`

Required environment variable:

```bash
VITE_API_BASE_URL=https://allowanceai-backend.onrender.com
```

Recommended version environment variable:

```bash
VITE_APP_VERSION=1.0.7
```

After Vercel gives you the frontend URL, update the backend Render `FRONTEND_URL` value to that URL. Example:

```bash
FRONTEND_URL=https://your-vercel-frontend-url.vercel.app
```

## CORS Note

The backend allows local frontend origins and the deployed Render frontend origin by default. For Vercel, set `FRONTEND_URL` in Render to the exact Vercel frontend URL. If this is not updated, browser calls from Vercel may fail CORS preflight checks.

## PWA Install and Updates

AllowanceAI is installable as a PWA from supported browsers. The app-rendered install button is shown only on the login screen; authenticated dashboard screens do not show an app install button.

The frontend checks `public/version.json` on app load and every 60 seconds with `cache: "no-store"`. If the deployed version differs from the bundled `VITE_APP_VERSION`, AllowanceAI shows a `New update available` banner with a `Reload` button.

Before each frontend deployment, bump all three version values:

```bash
# allowanceai/frontend/public/version.json
{ "version": "1.0.7" }

# allowanceai/frontend/public/sw.js
const DEPLOYMENT_VERSION = "1.0.7";

# Vercel environment variable
VITE_APP_VERSION=1.0.7
```

## Main API Endpoints

- `GET /`
- `GET /health`
- `GET /ready`
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
- `GET /api/insights/monthly`
- `POST /api/monthly-plan`
- `POST /api/evaluate-list`
- `POST /api/shopping-lists`
- `GET /api/shopping-lists`
- `GET /api/shopping-lists/{list_id}`
- `PATCH /api/shopping-lists/{list_id}`
- `DELETE /api/shopping-lists/{list_id}`
- `GET /api/timetable`
- `GET /api/reports/monthly`
- `POST /api/can-i-buy`

## Saved Shopping Lists

Users can evaluate a shopping list, save it, view saved lists later, edit saved list names/items, and delete saved lists. Saved lists are user-owned:

- Normal users only see their own shopping lists.
- Normal users can only edit or delete their own shopping lists.
- Admin users do not see private shopping list details unless an admin feature is explicitly added later.

Saved shopping lists are included in account export and removed during account deletion.

## Account Data Export

Authenticated users can export their own data from Profile Settings. The export includes:

- User profile metadata
- Budgets
- Categories
- Expenses
- Monthly reports
- Budget intelligence
- Alerts
- Behavior tracking
- Saved shopping lists
- Notifications

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

## Account Deletion

Authenticated users can delete their own account from Profile Settings. Account deletion removes user-owned:

- Budgets
- Categories
- Expenses
- Behavior tracking rows
- Notifications
- Saved shopping lists and saved shopping list items

## Admin

Users have a `role` field of `user` or `admin`. Existing users default to `user`.

Set this backend environment variable to promote existing accounts on startup:

```bash
ALLOWANCEAI_ADMIN_EMAILS=admin@example.com,owner@example.com
```

Admin endpoints:

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/health`

Admin endpoints return 403 for non-admin users. Admins can view system stats, user lists without password hashes, and admin readiness from the Admin Dashboard.

## Copy Local Account Data To Render

Local and deployed accounts use different PostgreSQL databases. To use the same account and budget data online, copy local PostgreSQL rows to the Render PostgreSQL database.

Get the Render PostgreSQL external database URL from Render, then run this locally from `allowanceai/backend`:

```bash
set TARGET_DATABASE_URL=postgresql://render-user:render-password@render-host/render-db
set MIGRATE_USER_EMAIL=you@example.com
python migrate_postgres_to_render.py
```

`MIGRATE_USER_EMAIL` is optional. If set, only that account and its budgets, categories, expenses, behavior tracking rows, and related user data are copied. Do not commit the Render database URL.

## Default New Account Data

When a user registers, AllowanceAI seeds that user with a default monthly budget plus these categories:

- Food: R500
- Snacks: R200
- Cosmetics: R150
- Data Bundles: R250
- Mokhatlo: R200
- Savings: R100
- Emergency: R100

Use `Data Bundles` for prepaid or provider-neutral data budgets such as Vodacom, MTN, or Econet bundles. Use names such as `Contract Data` or `Monthly Data` for fixed monthly data payments; when those are fully paid, AllowanceAI treats them as paid commitments instead of danger spending.

## Verification

Backend:

```bash
cd allowanceai/backend
python -m compileall .
```

Frontend:

```bash
cd allowanceai/frontend
npm run build
```
