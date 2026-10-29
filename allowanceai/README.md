# AllowanceAI

AllowanceAI is an independent personal budgeting product founded, developed and owned by [Matsoso Phomolo](https://matsoso.dev/). Users retain their rights in their financial information. Product code and identity are proprietary. Existing contributors remain credited in Git history.

## Architecture and capabilities

React 18 + Vite frontend on Vercel; FastAPI backend on Render; PostgreSQL through SQLAlchemy. Financial logic and models remain in `backend/crud.py`, `decision_engine.py`, `ai_rules.py` and `models.py`.

Supported: monthly allowance and savings targets, categories, expense CRUD, saved shopping lists, purchase evaluation, monthly planner, timetable, reports/charts, rule-based insights, alerts, in-app notifications, profile/password updates, account export/deletion and admin statistics. Savings is a target/category, not a separate ledger. No bank integration, automatic income tracking, external generative AI or self-service password recovery is implemented. Existing registration creates starter budget/category amounts: review and replace these; they are not bank balances.

## Frontend structure and routing

`src/main.jsx` mounts BrowserRouter; `App.jsx` owns existing account/data actions and protects `/app`. `components/PublicSite.jsx` provides the public experience. `Dashboard.jsx` retains all financial components and maps selection to URLs. `api.js` retains the API contract and bearer-token storage. `styles.css` includes semantic color tokens and responsive public/application styles.

Public routes: `/`, `/features`, `/how-it-works`, `/about`, `/help`, `/login`, `/register`, `/privacy`, `/terms`. Root always renders the homepage, including for authenticated users. Unknown public URLs show a not-found page. Privacy/terms pages disclose that approved formal policies are pending; owner/legal review remains a release requirement.

Authenticated routes: `/app`, plus `/app/budget`, `/app/categories`, `/app/recent-expenses`, `/app/add-expense`, `/app/add-category`, `/app/graphs`, `/app/spending-timetable`, `/app/monthly-planner`, `/app/category-survival`, `/app/ai-recommendations`, `/app/budget-intelligence`, `/app/monthly-insights`, `/app/can-i-buy`, `/app/shopping-list`, `/app/alerts`, `/app/profile`. Aliases: dashboard→budget, budgets→budget, transactions→recent-expenses, savings→budget, shopping→shopping-list, reports→graphs, settings→profile. Notifications remain available in the header. Admin panels remain role-gated inside the dashboard; backend admin endpoints enforce authorization independently. Unknown app sections display an explanatory message and budget section.

## Authentication and data

Registration/login preserve the backend account flow and signed expiring bearer tokens. Existing token is stored in localStorage and restored via `/api/auth/me`. A non-login 401 clears the token and invalidates the displayed session. Login destinations accept only internal `/app` paths, preventing external redirects. Logout clears account state/token and returns home. Public pages do not await session restoration. Passwords use the existing salted PBKDF2 hashes. Browser storage remains a security consideration: use HTTPS and log out on shared devices.

Profile includes export, account deletion and password change. Account deletion is destructive and remains subject to the existing confirmation flow. No production data migration or database reset is required by this release.

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

Local API defaults to `http://127.0.0.1:8000`; frontend uses port 5173. Backend requires a PostgreSQL DATABASE_URL. Never commit environment secrets. Existing backend startup can create/adjust tables; use an isolated database for local tests. Do not run migration/seed scripts on production without review.

## Production deployment

Frontend Vercel root: `allowanceai/frontend`; Vite preset; `npm ci && npm run build`; output `dist`. Set `VITE_API_BASE_URL=https://allowanceai-backend.onrender.com` in Production before building. Production fallback also uses this URL. `vercel.json` rewrites extensionless SPA paths to index.html while leaving assets/files available. This must be verified on the deployed project.

Render root: `allowanceai/backend`; build `pip install -r requirements.txt`; start `uvicorn main:app --host 0.0.0.0 --port 10000`. Required secrets: DATABASE_URL and ALLOWANCEAI_SECRET_KEY. Set `FRONTEND_URL=https://allowance-ai-omega.vercel.app`. That exact origin is also explicitly allowed in source. Optional ALLOWANCEAI_ADMIN_EMAILS controls existing admin promotion. Do not alter production secrets or database records for this frontend release.

Public frontend: https://allowance-ai-omega.vercel.app/
Backend: https://allowanceai-backend.onrender.com

Check `/health`, `/ready` (database readiness), real login/account requests, role rejection and OPTIONS preflight from the exact frontend origin after deployment. Health alone does not verify authentication or financial endpoints. Hosting environment values were not accessible during this implementation.

## PWA

Manifest/icons and service worker are preserved. Installed apps intentionally start at `/`, then users open Dashboard. Chrome/Edge may expose an installation prompt; Safari uses Share → Add to Home Screen. A shared PWAInstallPrompt offers installation after homepage load only when a native eligibility event is available. Public navigation, Help and the app menu allow later installation or browser-specific guidance. Login and registration cards have no installation section or developer credit; public About/footer attribution remains. No HTML launcher is downloaded.

Worker uses network-first public resources and same-origin pages, skips cross-origin API traffic, caches successful responses and clears only old AllowanceAI cache names. Cached navigation/app resources may open offline; financial operations require connectivity. `/offline.html` is the final fallback. Test installation and offline behavior on real devices before release. Safe-area viewport and reduced-motion styling are included.

Release version is `1.2.2`. Update `public/version.json` and `DEPLOYMENT_VERSION` in `public/sw.js` together for every release. App version reads the build-time JSON, avoiding stale Vercel version environment values. Polling displays an update banner when the deployed JSON differs. Existing `VITE_APP_VERSION` is no longer authoritative.

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
