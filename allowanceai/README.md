# AllowanceAI

AllowanceAI is an independent personal budgeting product founded, developed and owned by [Matsoso Phomolo](https://matsoso.dev/). Users retain their rights in their financial information. Product code and identity are proprietary. Existing contributors remain credited in Git history.

## Architecture and capabilities

React 18 + Vite frontend on Vercel; FastAPI backend on Render; PostgreSQL through SQLAlchemy. Financial logic and models remain in `backend/crud.py`, `decision_engine.py`, `ai_rules.py` and `models.py`.

Supported: monthly allowance and savings targets, categories, expense CRUD, saved shopping lists, purchase evaluation, monthly planner, timetable, reports/charts, rule-based insights, alerts, in-app notifications, profile/password updates, account export/deletion and admin statistics. Savings is a target/category, not a separate ledger. No bank integration, automatic income tracking, external generative AI or self-service password recovery is implemented. New registration creates only the account: no budget, categories, expenses, lists or financial notifications. Financial totals begin at zero and the current budget is explicitly unconfigured until saved. Existing user records are never reset.

## Frontend structure and routing

`src/main.jsx` mounts BrowserRouter; `App.jsx` owns existing account/data actions and protects `/app`. `components/PublicSite.jsx` provides the public experience. `Dashboard.jsx` retains all financial components and maps selection to URLs. `api.js` retains the API contract and bearer-token storage. `styles.css` retains public styles and shared tokens; `workspace.css` provides the separate authenticated shell. `WorkspaceOverview.jsx` renders real monthly totals and empty states.

Public routes: `/`, `/features`, `/how-it-works`, `/about`, `/help`, `/login`, `/register`, `/privacy`, `/terms`. Root always renders the homepage, including for authenticated users. Unknown public URLs show a not-found page. Privacy/terms pages disclose that approved formal policies are pending; owner/legal review remains a release requirement.

Authenticated routes: `/app` (overview), `/app/overview`, `/app/notifications`, role-gated `/app/admin`, plus `/app/budget`, `/app/categories`, `/app/recent-expenses`, `/app/add-expense`, `/app/add-category`, `/app/graphs`, `/app/spending-timetable`, `/app/monthly-planner`, `/app/category-survival`, `/app/ai-recommendations`, `/app/budget-intelligence`, `/app/monthly-insights`, `/app/can-i-buy`, `/app/shopping-list`, `/app/alerts`, `/app/profile`. Aliases: dashboard→overview, budgets→budget, transactions→recent-expenses, savings→budget, shopping→shopping-list, reports→graphs, settings→profile. Notifications are available in the compact header and their own section. Sidebar groups consolidate related modules; contextual tabs retain every previous section. Public Home/Help links are absent from the workspace. Admin panels and backend endpoints remain role-gated. Unknown sections show an explanatory message and overview.

## Authentication and data

Registration/login preserve the backend account flow and signed expiring bearer tokens. Existing token is stored in localStorage and restored via `/api/auth/me`. A non-login 401 clears the token and invalidates the displayed session. Login destinations accept only internal `/app` paths, preventing external redirects. Logout clears account state/token and returns home. Public pages do not await session restoration. Passwords use the existing salted PBKDF2 hashes. Browser storage remains a security consideration: use HTTPS and log out on shared devices.

Profile includes export, account deletion and password change. Account deletion is destructive and remains subject to the existing confirmation flow. The prepared item-ledger enhancement requires reviewed Alembic migrations before backend startup; it does not require a database reset. See ITEM-LEDGER-DEPLOYMENT.md.

## Local development

Backend (Python 3.11 recommended):

```sh
cd allowanceai/backend
pip install -r requirements.txt
# Set DATABASE_URL, ALLOWANCEAI_SECRET_KEY and FRONTEND_URL locally
uvicorn main:app --reload
```

Frontend:

```sh
cd allowanceai/frontend
npm ci
# Copy .env.example to .env for optional local configuration
npm run dev
npm run build
```

Local API defaults to `http://127.0.0.1:8000`; frontend uses port 5173. Backend requires DATABASE_URL. Never commit environment secrets. PostgreSQL requires `python -m alembic upgrade head` before startup; schema changes are explicit and reviewed. SQLite is available for isolated local tests. Never enable ALLOWANCEAI_TEST_CREATE_SCHEMA in production. Do not run legacy copy/migration scripts on production.

## Production deployment

Frontend Vercel root: `allowanceai/frontend`; Vite preset; `npm ci && npm run build`; output `dist`. Set `VITE_API_BASE_URL=https://allowanceai-backend.onrender.com` in Production before building. Production fallback also uses this URL. `vercel.json` rewrites extensionless SPA paths to index.html while leaving assets/files available. This must be verified on the deployed project.

Render root: `allowanceai/backend`; build `pip install -r requirements.txt`; start `uvicorn main:app --host 0.0.0.0 --port 10000`. Required secrets: DATABASE_URL and ALLOWANCEAI_SECRET_KEY. Set `FRONTEND_URL=https://allowance-ai-omega.vercel.app`. That exact origin is also explicitly allowed in source. Optional ALLOWANCEAI_ADMIN_EMAILS controls existing admin promotion. Do not alter production secrets or database records for this frontend release.

Public frontend: https://allowance-ai-omega.vercel.app/
Backend: https://allowanceai-backend.onrender.com

Check `/health`, `/ready` (database readiness), real login/account requests, role rejection and OPTIONS preflight from the exact frontend origin after deployment. Health alone does not verify authentication or financial endpoints. Hosting environment values were not accessible during this implementation.

## PWA

Manifest/icons and service worker are preserved. Installed apps intentionally start at `/`, then users open Dashboard. Chrome/Edge may expose an installation prompt; Safari uses Share → Add to Home Screen. A shared PWAInstallPrompt offers installation after homepage load only when a native eligibility event is available. Public navigation, Help and the app menu allow later installation or browser-specific guidance. Login and registration cards have no installation section or developer credit; public About/footer attribution remains. No HTML launcher is downloaded.

Worker uses network-first public resources and same-origin pages, skips cross-origin API traffic, caches successful responses and clears only old AllowanceAI cache names. Cached navigation/app resources may open offline; financial operations require connectivity. `/offline.html` is the final fallback. Test installation and offline behavior on real devices before release. Safe-area viewport and reduced-motion styling are included.

Prepared item-ledger release version is `1.4.0`; it has not been pushed or deployed. Update `public/version.json` and `DEPLOYMENT_VERSION` in `public/sw.js` together for every release. App version reads the build-time JSON, avoiding stale Vercel version environment values. Polling displays an update banner when the deployed JSON differs. Existing `VITE_APP_VERSION` is no longer authoritative.

## Testing and troubleshooting

```sh
cd allowanceai/frontend
npm run build
# Browser regression checks require Playwright and installed Edge:
npm install --no-save playwright
node tests/browser-smoke.cjs
# Set PLAYWRIGHT_CHANNEL=chrome to use installed Chrome instead
```

Smoke tests mock API responses only inside the test runner. They never seed production dashboards or create accounts. They verify five widths, public direct routes, mobile navigation, protected redirects, invalid credentials, safe redirect, authenticated homepage and logout. They do not replace financial backend integration tests.

Backend syntax: `python -m compileall -q allowanceai/backend` from repository root. Use a complete Python installation (some MySQL-bundled interpreters cannot run standard Python tools).

Connection failures can mean network, Render startup/service issues, or browser CORS settings. Check browser Network responses and exact-origin OPTIONS. Validation, unauthorized sessions and service errors have distinct client messages. Missing routes after refresh indicate incorrect Vercel root or missing rewrite deployment. For stale PWA content check release versions, reload online, and inspect worker registration.

See `IMPLEMENTATION-INVENTORY.md` and `IMPLEMENTATION-REPORT.md` for scope, verification evidence and remaining release work.

PWA production-build smoke check: start `npm run preview -- --host 127.0.0.1 --port 4173`, then run `node tests/pwa-smoke.cjs` with Playwright available.
Frontend builds require Node.js 20 or newer (Node.js 24 used for this verification). Set a compatible Node version in Vercel project settings.

## Budgeting identity and currency display

The public site and application share a Lesotho-inspired green palette: #EAF5E8 page background, #D4EBCB secondary surfaces, #277A43 actions, #173D2C text and #8DBD75 accents. White cards/forms preserve readability. CSS tokens define the palette; no banknote imagery is used. Backend budget summaries supply monthly budget, total planned, actual expenditure, remaining budget and savings goal. Status labels accompany color, and a negative remaining amount displays Over budget.

The app header offers ZAR (existing default) and LSL (M) display formats. Selection is saved only in this browser, never to PostgreSQL. Currency selection changes formatting only: no conversion, numeric changes, schema changes or backend preference overrides. Choose the denomination used for your existing entries. The public demonstration explicitly uses LSL. Structured amounts throughout the workspace use the shared currency formatter; backend-generated narrative advice retains original currency wording. Account export/CSV raw amounts remain numeric and unchanged. Income tracking is not advertised because the backend only supports allowance planning.

Currency tests: `node --test tests/currency.test.cjs`. Browser tests also verify selection persistence, ZAR restoration, status labels and authenticated widths. See BUDGETING-IDENTITY-REPORT.md for this release.

Installation lifecycle checks: `node tests/pwa-install-smoke.cjs` with Playwright/Edge available. The provider captures one deferred native event, waits 2.5 seconds after homepage load, and remembers impressions/dismissals in localStorage. It suppresses automatic suggestions on authentication and other routes, and suppresses controls for standalone or known installed apps. Native installation is invoked only from a user click. Browser guidance dialogs never expose a nonfunctional native Install button. Storage keys: allowanceai_pwa_prompt_seen_v1, allowanceai_pwa_install_dismissed, allowanceai_pwa_installed. A fresh eligibility event permits reinstall after uninstall. If browser storage is disabled, persistence across reloads cannot be guaranteed. Installed-app detection across unrelated browser profiles/devices is limited by browser APIs.

Public contact controls are compact Email and WhatsApp icon links in the footer and Help contact section. Contact values appear only in link destinations. Accessible names, focus-visible outlines, 44px targets and hover/focus tooltips (dismissible with Escape) are included. The unmodified official WhatsApp glyph is stored in public/brand/whatsapp.svg; public/brand/SOURCE.md records its Meta source.

## Zero-default financial workspace

Registration no longer imports a seeder. The historical seed.py module was removed. Existing financial records, including old starter amounts, are deliberately not rewritten because automated cleanup cannot reliably distinguish them from intentional user entries. Planner proposal fields now start at zero, and form placeholders contain no fabricated balance.

GET /api/budget returns additive `configured` and `month` fields. Absence is `configured=false`; an explicitly saved zero budget is `configured=true`. Optional `?month=YYYY-MM` retrieves that user's selected month. The budget editor loads the selected month independently, and saving updates the user's latest budget for that month. Current-month summaries, category usage, reports and behavior metrics use current-month expenses; full spending history remains available. Category allocation limits are reusable user-owned templates because the existing model has no category-month column. Historical category-limit snapshots are not introduced by this release.

Missing budgets do not hide real spending: existing expenses still contribute to actual expenditure and the remaining amount, with the budget marked unconfigured. Analytics/intelligence empty states avoid meaningless charts and advice. Currency preferences change display only. Late responses from an old session cannot repopulate the current user's workspace or clear a newer token.

### Backend regression checks

```sh
cd allowanceai/backend
pip install -r requirements-test.txt
python -m unittest discover -s tests -v
# Optional: same suite in temporary schemas on a verified loopback PostgreSQL server.
# Uses WORKSPACE_TEST_POSTGRES_URL, or the existing local-only .env URL.
python tests/run_local_postgres.py
```

The default suite forces an isolated in-memory SQLite database. The PostgreSQL runner refuses remote hosts, verifies the server's loopback address, and creates uniquely named test schemas; cleanup removes only its own temporary tables/schemas. Never point tests at Neon or a production connection.

### Real API/browser workflow

```sh
# Terminal 1 (backend): disposable local SQLite API, fixed test-only secret, no production URL
python tests/serve_workspace_test.py
# Terminal 2 (frontend), set this only for this dev process
VITE_API_BASE_URL=http://127.0.0.1:8001 npm run dev
# Terminal 3 (frontend), with Playwright and installed Edge available
node tests/workspace-e2e.cjs
```

On PowerShell use `$env:VITE_API_BASE_URL='http://127.0.0.1:8001'` before `npm run dev`. The browser workflow creates isolated test accounts, saves monthly budgets/categories/expenses, checks persistence and user isolation, and writes screenshots in docs/. It never seeds production or changes Neon/Render secrets. Stop the test API to remove its temporary database. See WORKSPACE-IMPLEMENTATION-REPORT.md for actual results and production limitations.


## Item-driven planning and purchase ledger (prepared locally)

Monthly Planner and Shopping Lists now share saved item workspaces: product/package metadata, quantities, Decimal estimates, automatic deterministic categorization with user corrections, partial purchases, explicit previews/confirmation and auditable linked expenses. Savings remain separate. Plan settings/estimates never create expenses. Existing tools remain in compatibility sections, and old lists can be explicitly imported once without changing their source. Analytics compares one selected plan without adding estimates to actual expenses.

See [implementation plan](INTELLIGENT-BUDGETING-PLAN.md), [implementation report](INTELLIGENT-BUDGETING-REPORT.md), and [migration/release runbook with API contracts and complete checklist](ITEM-LEDGER-DEPLOYMENT.md). The runbook explains NUMERIC migration, immutable purchase history, idempotency, category allocation semantics and release sequencing. No external AI provider is configured; ambiguous products ask for review.

Backend verification (from backend/):

```text
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -p "test_*.py" -v
python tests/run_local_postgres.py
```

The first suite forces isolated SQLite. The PostgreSQL runner accepts only a loopback PostgreSQL test server and creates/removes UUID-named temporary schemas; it must never use Neon credentials. It reads WORKSPACE_TEST_POSTGRES_URL or the existing local-only backend environment in memory. PostgreSQL tests cover true concurrent confirmations and transactional migration rollback.

Real browser verification: start `python tests/serve_workspace_test.py` in backend/ (a disposable SQLite API on 8001), run Vite on 5173 with VITE_API_BASE_URL=http://127.0.0.1:8001, then run `node tests/items-e2e.cjs` in frontend/ with Playwright/Edge installed. The script is fixed to these local URLs and creates only disposable local accounts/records. It enters/partially buys rice through the UI and confirms 65 of 100 shopping items through the UI; 100-row setup uses the real local API. Set WORKSPACE_SKIP_SCREENSHOTS=1 when running the older workspace-e2e.cjs to retain the existing overview screenshots.


## Production-readiness remediation (local, not deployed)

See [READINESS-REMEDIATION.md](READINESS-REMEDIATION.md) and the remediation appendix in [PRODUCTION-READINESS-AUDIT.md](PRODUCTION-READINESS-AUDIT.md). Required head is now `0003_month_allocations`. Category allocations are month-scoped; old shared values are preserved as archival source values and copied only with `legacy_snapshot` provenance. New API money is Decimal serialized as exact strings, while historical sub-cent values remain unchanged. Financial writes/rebuilds share a transaction/user lock. Manual expense creates accept an optional operation_key for reliable retries; the bundled UI supplies and recovers it. Vite is pinned to patched 6.4.5. Production remains NO-GO until read-only Neon schema/history verification and backup/restore rehearsal are complete.

To test both PostgreSQL session modes, set WORKSPACE_TEST_AUTOFLUSH to 0 and 1 respectively and run `python tests/run_local_postgres.py` for each mode. Never run that loopback-only runner with production credentials. The read-only production preflight is `python inspect_schema_readonly.py` with the intended securely injected environment; it does not load local .env or execute migrations.
# Phase 9 security and infrastructure verification

The local release candidate uses the patched backend stack documented in
[PHASE9-RELEASE-GATES.md](PHASE9-RELEASE-GATES.md). Install the pinned
`backend/requirements-bootstrap.txt` tooling before application/test requirements
in a new virtual environment. Audit tools have separate requirements and should
not be installed in the serving environment unnecessarily.

Production remains **NO-GO** pending actual Neon identity/schema/history and an
approved isolated backup/restore rehearsal. Follow
[DATABASE-VERIFICATION-RUNBOOK.md](DATABASE-VERIFICATION-RUNBOOK.md); the read-only
inspection helper now requires independently confirmed identity variables and
does not load `.env`. Historical Phase 8 hashes/audit results describe the prior
candidate, not the upgraded Phase 9 source. No deployment is authorized by these
documents.
