# Website and application integration verification

Date: 2 November 2026 (Africa/Johannesburg).

## Recommendation: NO-GO for production release

The existing public website and financial workspace compile successfully. Fresh browser and backend regression verification did not complete in this environment. Previous release reports are historical evidence, not fresh passing results. No commit, push, merge, deployment, production database access or credential change was performed.

## Implementation inventory and preservation

The working tree already contains extensive uncommitted financial changes, including decimal money contracts, monthly allocations, item ledgers, idempotency, migrations and reconciliation tests. They were preserved. Existing PublicSite, Login, Register, Dashboard, WorkspaceOverview, ItemWorkspace, ItemAnalytics, planner, shopping, reports, notifications, settings and administrator modules were inspected rather than duplicated.

React Router is initialized in main.jsx. App.jsx renders public pages before authentication guards, allowing authenticated visitors to remain on the homepage. Protected paths require restored authentication. Login destinations are constrained to application paths. Logout and session-expiry handling already exist. Runtime behavior still requires the fresh browser regression gate below.

## Changes in this verification pass

- public/sw.js now explicitly excludes /api/ requests and requests carrying Authorization from service-worker interception. Cross-origin and non-GET requests were already excluded. Static HTML shells do not contain account data; financial responses must remain network-only.
- Created this report. No financial schema, calculations, API contract, credentials or production infrastructure was changed.

## Route inventory

Public: /, /features, /how-it-works, /about, /help, /privacy, /terms. Authentication: /login, /register. Protected application namespace: /app and its existing Dashboard navigation destinations, covering financial overview, monthly planning, item management/analytics, expenses, categories, shopping lists, reports, insights, notifications and profile/settings. Admin functionality retains role checks. No pricing page is advertised as a paid offer; pricing and contact routes were not introduced. Help provides the existing support path. Formal privacy/terms approval remains a documented limitation.

The Vercel configuration rewrites extensionless navigation to index.html and excludes assets and file paths. Source includes the exact production frontend origin in backend CORS. No remote Vercel environment or deployed rewrite behavior was verified.

## Fresh checks and actual results

| Check | Result |
|---|---|
| Frontend production build | PASS: Vite 6.4.5; 692 modules |
| Currency unit suite | PASS: 2/2 |
| npm dependency audit | PASS: zero reported vulnerabilities; Windows system CA enabled, TLS verification retained |
| Backend unittest discovery | INCOMPLETE: stalled on first adoption test; interrupted, no passing suite claimed |
| Browser smoke | BLOCKED: sandbox Edge launch access errors; elevated retry timed out connecting to local frontend |
| Built PWA smoke | BLOCKED: Edge launch access errors |
| PWA install smoke | BLOCKED: Edge launch access errors |
| Backend pip-audit | BLOCKED: pip_audit unavailable in selected bundled Python |
| Real financial/browser reconciliation suites | NOT VERIFIED in this pass |
| Production health/auth/CORS/database | NOT ACCESSED in this local-only pass |

## Outstanding gates

Run the backend suite with a functioning isolated test runtime and disposable database fixtures; diagnose the adoption-test stall before claiming financial regressions pass. Run workspace, items and remediation E2E suites against an isolated local backend. Run public browser smoke and PWA suites with frontend servers and browser in the same reachable execution environment. Validate direct route refresh, safe redirects, restoration, logout, user isolation, mobile widths and offline behavior through those suites. Install/use the repository audit tooling in an isolated environment and rerun the backend dependency audit; prior reports record unresolved backend advisories.

The public website already describes supported budgeting and rule-based guidance. No pricing, certification or unimplemented financial capability was added. Installed PWA launch remains /; financial operations require connectivity. Native installation requires supported-device manual verification even after simulated-event tests pass.

The source remains local and reviewable. Full success acceptance and production readiness are not established until the outstanding regression and deployment gates pass.

## Interrupted-verification follow-up — 2 November 2026

This section supersedes the incomplete local results above. Production remains **NO-GO**. Phase 9 reports supersede the historical Phase 8 dependency findings; neither historical report substitutes for the fresh checks here.

### Stall diagnosis and execution environment

The original command was bundled Python `-m unittest discover -s tests -v`. Bounded reproduction used `python -c 'import faulthandler,unittest; faulthandler.dump_traceback_later(20,exit=True); suite=unittest.defaultTestLoader.discover("tests",pattern="test_adoption.py"); unittest.TextTestRunner(verbosity=2).run(suite)'`. It exited 1 after 20 seconds on `test_already_stamped_head_does_not_hide_schema_drift`. The traceback shows test_workspace.py:73, TestClient.__enter__, AnyIO blocking portal, asyncio Windows proactor self-pipe creation, socket._fallback_socketpair and socket.accept. No test assertion had run. This locates the stall in the sandbox event-loop/socket environment rather than demonstrating a database timeout or failed financial assertion.

Used existing isolated runtime `C:/Users/windows 10/AppData/Local/Temp/allowanceai-phase9-runtime-53f73e066b31438c9b3a6c03ca9793bf/Scripts/python.exe` (RUNTIME below), outside the sandbox. `tests/run_local_postgres.py` accepts only loopback PostgreSQL credentials and validates server loopback identity; each test creates a UUID schema. No Neon connection was made.

Exact matrix invocation from backend: `RUNTIME -c 'import faulthandler,runpy; faulthandler.dump_traceback_later(120,exit=True); runpy.run_path("tests/run_local_postgres.py",run_name="__main__")'` with default autoflush disabled: **45 tests PASS, 84.324 seconds**. With `$env:WORKSPACE_TEST_AUTOFLUSH='1'` and timeout 180: **45 tests PASS, 81.636 seconds**. An intervening 30-second diagnostic run was cut off while progressing and is not counted as a suite pass. Hard interruption can leave a disposable schema behind; no broad database cleanup was performed.

### Fresh browser and PWA evidence

Sandbox Edge failures were access-denied startup errors. Moving only Edge outside the sandbox failed with ERR_CONNECTION_TIMED_OUT to sandbox Vite. Running both Vite and Edge outside the sandbox resolved the restriction.

From frontend, set `$env:NODE_PATH='C:/Users/windows 10/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'`. Commands run through the approved elevated local environment:

- `npm.cmd run dev -- --host 127.0.0.1 --port 5173` and `node tests/browser-smoke.cjs`: **PASS**. API fixtures are mocked here. Covers five homepage widths, public routes, protected-route guard, invalid credentials, safe redirects, mobile navigation/refresh, authenticated homepage, currency persistence, budget states and logout without browser runtime errors.
- `npm.cmd run preview -- --host 127.0.0.1 --port 4173`; `node tests/pwa-install-smoke.cjs`; `node tests/pwa-smoke.cjs`: **PASS**. Simulated native install eligibility/dismissal/acceptance, standalone suppression, iOS guidance, focus, service-worker registration, manifest, offline homepage and direct built Help navigation. Native installation on physical devices remains manual verification.
- Real financial browser API: RUNTIME starts uvicorn on 127.0.0.1:8001 with DATABASE_URL explicitly replaced before app import by a new UUID-named SQLite file in the temporary directory; test-only schema creation enabled. Vite restarted with VITE_API_BASE_URL=http://127.0.0.1:8001. This is separate from PostgreSQL matrix evidence and uses no existing financial accounts.
- `node tests/workspace-e2e.cjs`: **PASS**. Registration, zero state, monthly budget editing, category/expense CRUD, totals, refresh/login persistence, second-account isolation, retained modules/charts, notifications and admin denial.
- `node tests/remediation-e2e.cjs`: **PASS**. Monthly/shopping direct navigation, history/deep-link refresh, purchase commit/lost-response/reload/same-key retry and manual-operation retry, with one expense/event and pending quantities preserved.
- `node tests/items-e2e.cjs`: first run **FAIL** at line 220 waiting 30000ms for /purchase-preview during the 100-item/65-selection UI scenario. Earlier monthly entry, automatic categories, save/reopen, allocations, partial confirmation, linked expenses/analytics and five widths passed. Individual rerun is recorded below. Sequential shell command exit was zero because the later remediation command passed; this does not erase the item-suite failure.

### Cache boundary and security

Service worker now bypasses /app and /app/* in addition to API paths, Authorization-bearing requests, cross-origin requests and writes. Added `tests/sw-cache-boundary.test.cjs`, which executes the real worker fetch handler across account-A, logged-out and account-B request headers and asserts zero interceptions for private routes. This is a deterministic boundary test, not a claim of native offline financial operations. Initial test harness lacked URL in its VM context; corrected the harness without changing assertions. Existing deployed caches are not remotely inspected or purged by this local change.

`node --test tests/currency.test.cjs tests/sw-cache-boundary.test.cjs`: **3/3 PASS**. `npm.cmd run build`: **PASS**, 692 modules, including the latest worker change. `git diff --check`: **PASS** (line-ending warnings only). `RUNTIME -m pip check`: **PASS**, no broken requirements.

`$env:NODE_OPTIONS='--use-system-ca'; npm.cmd audit --json`: **PASS**, zero reported vulnerabilities. Python audit initially failed certificate validation. Retried with the existing tooling Python at `C:/Users/windows 10/AppData/Local/Temp/allowanceai-phase9-tooling-2fb3baa8a86e4c87aeb7eebcb5668156/Scripts/python.exe`: `-c 'import pip._vendor.truststore as truststore; truststore.inject_into_ssl(); import sys,runpy; sys.argv=["pip-audit","--path",r"C:\Users\windows 10\AppData\Local\Temp\allowanceai-phase9-runtime-53f73e066b31438c9b3a6c03ca9793bf\Lib\site-packages","--format","json"]; runpy.run_module("pip_audit",run_name="__main__")'`: **exit 0, no known vulnerabilities**, 31 installed packages inspected. Certificate verification remained enabled. This audits the local runtime, not the production image.

### Production decision

The standalone unchanged `node tests/items-e2e.cjs` rerun completed with **exit 0**: all item workflows passed, including 100 items, 65 confirmed purchases, 35 pending, exactly 65 additional expenses and persistence after refresh. The earlier purchase-preview timeout remains a recorded transient browser-test failure; its cause was not conclusively established and assertions/timeouts were not weakened. Both backend matrix runs also passed the 100/65/35 and partial-purchase/idempotency checks. Local mandatory suites now have passing complete runs, with this flakiness limitation retained.

Retain **NO-GO** pending the item browser outcome and all mandatory provider gates: actual Neon identity/schema/history compatibility, approved backup and isolated restore/reconciliation rehearsal, production Python/OS/image/configuration parity, migration lock timing/recovery, immutable reviewed candidate and deployment authorization. No production database, infrastructure, credentials, source-control publication or release action was performed. Existing uncommitted work was retained.
