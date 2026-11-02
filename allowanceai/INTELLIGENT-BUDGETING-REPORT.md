# Intelligent budgeting implementation report — 30 October 2026

## Delivery status

Implemented and verified locally. **Not committed, pushed, migrated against Neon or deployed.** The working tree began clean on `main` at `ca094173e2d8fd99cf03ae7e353d491b92ccef4a`. No production provider, service name, credential, public website design, existing account or financial row was modified. Prepared frontend/PWA release version is 1.4.0. A production release requires explicit authorization and the migration-first sequence in [ITEM-LEDGER-DEPLOYMENT.md](ITEM-LEDGER-DEPLOYMENT.md).

## Completed phases

1. **Audit and design:** verified the nine existing tables, authentication and ownership filters, current-month summaries, rule-based financial heuristics, unsaved legacy monthly suggestions and amount-only saved shopping lists. No Alembic history or configured AI provider existed. The initial plan is recorded in [INTELLIGENT-BUDGETING-PLAN.md](INTELLIGENT-BUDGETING-PLAN.md).
2. **Schema and category foundation:** five shared ledger tables, NUMERIC money and quantity storage, Decimal calculations, strict request validation, deterministic regional product taxonomy, existing-category reuse, user-specific confirmed corrections, ambiguity handling and zero-allocation automatic categories. Package size and package count are independent. Migration preservation tests pass on SQLite and PostgreSQL; PostgreSQL transactional DDL rollback is verified separately.
3. **Planning and purchase service:** saved monthly/shopping workspaces share the same item semantics. Items can be edited/reordered/skipped/cancelled/reopened; actual purchases have date/quantity/price snapshots. Preview is read-only. Explicit confirmation atomically creates expenses, links them to items/events and refreshes existing derived logs. Per-user PostgreSQL row locks, version checks and unique idempotency keys prevent duplicate or excess confirmations. Invalid writes/failures roll back. Explicit monthly budget application replaces included allocations without creating expenses or adding savings to spending. Existing unrelated category allocations remain.
4. **Integrated interface:** shared responsive entry forms, server-backed suggestions, saved workspace selection, category correction, grouped totals, over-allocation warnings, purchase selection/actual-price review, confirmation, pending quantities, history and plan-vs-actual analytics. Existing legacy tools remain in expandable compatibility sections. Legacy list import is explicit and idempotent; originals stay unchanged. Expense history labels linked records read-only and adds a Show more action instead of silently limiting access to twelve rows. Account export and explicit account deletion include the new ledger.
5. **Verification and delivery:** real local API/browser workflows, PostgreSQL concurrency and migration tests, old workspace/public/auth/PWA regressions, production build and dependency review executed. No mock financial responses were used by the item workflow browser test.

## Financial guarantees and examples

- Rice, **2.5 kg per bag**, quantity **3**, estimated **30.00 per bag** → planned **90.00**. Size is never multiplied into the count-based price.
- Confirm **2 bags at 32.10** → exactly **64.20** actual expense and **1 pending bag**. Confirming the last bag later at 29.95 produces total **94.15**, two dated events and **4.15** price variance against immutable estimated prices at purchase.
- 100 one-unit planned items, confirm 65 at 29.99 → exactly 65 expense rows, **1949.35** actual and 35 pending. A separate real browser scenario confirmed 65 at 10.00 for **650.00**, leaving 35 pending after refresh.
- New ledger calculations use Decimal, ROUND_HALF_UP per line, and exact decimal response strings. For example 0.125 measured units ×0.12 rounds to 0.02. Fractional purchase quantities require a measured loose/service unit; packaged counts are integral.
- Saving/evaluating/editing/importing plans and lists does not record spending. Applying allocations is explicit and does not record spending. Existing reports sum the corresponding expense rows once; they never add planning estimates or purchase-line totals to expenses again.
- Reserved savings, planned spending, pending estimates, category allocations and recorded actual spending have separate labels and calculations.

## Files created

- `backend/item_models.py`: SpendingPlan, PlannedItem, CategoryPreference, PurchaseEvent, PurchaseLine.
- `backend/item_schemas.py`: validated Decimal item/plan/purchase inputs; forbidden client-calculated fields; quantity and date validation.
- `backend/category_engine.py`: versioned deterministic taxonomy/parent groups, normalization, suggestions, per-user preferences and zero-allocation category reuse/creation.
- `backend/item_service.py`: owned lookups, serialized item/plan/history summaries, atomic mutation service, purchase preview/confirmation, budget application and explicit legacy import.
- `backend/item_routes.py`: authenticated item-ledger endpoints.
- `backend/alembic.ini`, `backend/migrations/env.py`, frozen `legacy_schema.py`/`item_schema.py`, `versions/0001_legacy.py`, `versions/0002_item_ledger.py`: reviewed migration infrastructure; no destructive downgrade.
- `backend/tests/test_items.py`, `backend/tests/test_item_migrations.py`: financial, ownership, idempotency, concurrency, rollback, account lifecycle and migration compatibility regressions.
- `frontend/src/components/ItemWorkspace.jsx`, `ItemAnalytics.jsx`, `frontend/src/items.css`: shared item workspace and responsive analysis UI.
- `frontend/tests/items-e2e.cjs`: real local browser/API verification, including the 65-of-100 workflow.
- `docs/items-monthly-desktop.png`, `docs/items-monthly-mobile.png`: visually reviewed screenshots from disposable local test data.
- `INTELLIGENT-BUDGETING-PLAN.md`, `ITEM-LEDGER-DEPLOYMENT.md`, this report.

## Files modified

- `backend/models.py`: existing monetary storage mapped to NUMERIC with float-compatible legacy reads; registers shared ledger metadata.
- `backend/main.py`: registers item routes; PostgreSQL requires the reviewed migration revision rather than automatic startup DDL; existing configured admin allowlist behavior is retained without schema alteration.
- `backend/crud.py`: optional noncommitting behavior-log refresh for atomic purchases; linked-expense guards; planned-category deletion guard; ledger export/account deletion and imported-source preservation; additive expense provenance.
- `backend/schemas.py`: additive purchase event/origin item references in expense responses. Existing endpoints and request contracts remain.
- `backend/requirements.txt`: adds pinned Alembic 1.13.1; existing framework/auth/database driver pins remain.
- `backend/tests/test_workspace.py`: isolated schema setup and ownership-path checks for the extended model graph.
- `backend/tests/run_local_postgres.py`: discovers all regression suites in guarded loopback-only temporary schemas.
- `frontend/src/App.jsx`: passes existing refresh callback to new workflows.
- `frontend/src/api.js`: shared authenticated item API helper; no production API target change.
- `frontend/src/components/Dashboard.jsx`: connects shared item workflows/analytics; preserves legacy components and routes.
- `frontend/src/components/ExpenseHistory.jsx`: immutable linked purchase records and more-history control.
- `frontend/src/main.jsx`: imports scoped item styles.
- `frontend/public/version.json`, `public/sw.js`, `.env.example`: prepared version 1.4.0; existing caching/installation logic retained.
- `frontend/tests/workspace-e2e.cjs`: opens the retained legacy planner section and optionally skips regenerating existing screenshots; formatting normalized.
- `README.md`: current behavior, migrations, test commands and release links.

## New/modified API surface

New authenticated routes: GET/POST `/api/plans`; GET/PUT `/api/plans/{id}`; POST `/api/plans/{id}/items`; PUT/DELETE `/api/plans/{id}/items/{item_id}`; POST `/api/plans/{id}/reorder`, `/purchase-preview`, `/purchases`, `/apply-budget`; POST `/api/items/suggest-category`; GET `/api/items/taxonomy`; POST `/api/shopping-lists/{id}/import-items`.

Existing `/api/expenses` adds provenance fields. Direct edit/delete of confirmed purchase expenses now returns 409 to preserve reconciliation. Account export/delete covers the new tables. Existing list, budget, category, report, authentication and administration endpoints remain available. Full payload/retry semantics and the release verification checklist are in the runbook.

## Executed tests and actual results

| Check | Result |
|---|---|
| Pinned Python 3.11 / FastAPI 0.111.0 / SQLAlchemy 2.0.30 / Pydantic 2.7.4 / psycopg2 2.9.9 with Alembic 1.13.1 on real local PostgreSQL | Final 26-test suite PASS. Includes genuine same/different-key concurrent attempts, data isolation, migration upgrade/repeat/preservation/failure rollback and migrated production-style startup/admin allowlist |
| SQLite API/ledger suite | Final 26-test run PASS with two explicit skips: PostgreSQL row-lock concurrency and transactional DDL rollback (both pass on PostgreSQL). Earlier pinned SQLite run also passed, with documented TestClient resource warnings |
| `python -m compileall -q allowanceai/backend` | PASS |
| `node tests/items-e2e.cjs` | PASS against disposable real API. Registration, item entry/suggestions, save/reopen, allocation apply, two-of-three purchase at changed price, linked expense, plan analysis, 320/375/768/1024/1440 without horizontal overflow, 100-item list/65 confirmations/35 pending and refresh persistence; no browser runtime errors |
| `WORKSPACE_SKIP_SCREENSHOTS=1 node tests/workspace-e2e.cjs` | PASS. Existing financial CRUD, current/historical months, currency persistence, logout/login, second-user isolation, saved zero budget, all retained routes/charts/notifications/admin denial |
| `node tests/browser-smoke.cjs` | PASS. Public route/width/authentication/redirect/navigation/currency and workspace regressions; API fixtures are mocked in this older smoke suite, not in the new real item workflow |
| `node tests/currency.test.cjs` | PASS, display-only formatting |
| `node tests/pwa-install-smoke.cjs` | PASS, mocked eligibility/native-event lifecycle, dismissal/focus/standalone/iOS guidance; no physical-device installation claim |
| `node tests/pwa-smoke.cjs` against final production build | PASS, service worker/manifest/cached offline homepage/direct Help route |
| `npm run build` | PASS, 873 modules; no breaking frontend dependency change |
| `npm audit --json` with Windows system certificate trust | Completed, exit 1: two existing affected development-tool packages, esbuild moderate and Vite high; no security pass claimed and no forced major-version upgrade |
| `git diff --check` | PASS at release review; no secret/environment credentials added |

Earlier verification found and corrected an integer/boolean PostgreSQL test fixture mismatch and an HTML integer-quantity step/min mismatch that blocked purchase review. These failures are not silently counted as passes. Existing TestClient/AnyIO resource warnings and datetime.utcnow deprecation warnings appeared in test runs; no failed final assertions were hidden. Initial registry auditing failed certificate verification; system trust was enabled and TLS verification remained active for the successful audit.

Tests ran only on disposable SQLite databases and UUID-named schemas on a loopback PostgreSQL server. PostgreSQL guards verify both the configured host and actual server address; test cleanup removes only those new test schemas. No Neon URL was used, no production accounts were created, and no production records were cleaned/reset.

## Limitations and release requirements

- No external AI provider exists in the audited application. Classification is deterministic and extensible; unresolved/ambiguous items explicitly require review. Taxonomy hierarchy is system metadata rather than an editable user-category tree.
- Existing category limits remain shared user allocations, not historical monthly snapshots. Applying a plan retains other allocations; the UI explicitly warns about this. Alternative plans are compared individually, not summed into one presumed budget.
- New item/purchase arithmetic is Decimal. Existing legacy APIs/heuristics retain float-compatible interfaces to preserve established behavior; this release does not claim every old heuristic has been rewritten with Decimal.
- Confirmed purchase history is immutable. An audited reversal/adjustment workflow is not included. A page-open retry retains its confirmation key; after closing/reloading an uncertain confirmation, inspect history before creating a new purchase.
- Legacy lists contain no recoverable quantity/package or purchase metadata. Explicit import assumes one unit at the old total and requires review. Existing manual expenses are not automatically matched or imported as purchases.
- SQLite is not a production substitute for PostgreSQL concurrency or NUMERIC guarantees. Browser automation used desktop Edge with responsive widths; physical iOS/Android installation, full assistive-technology review and very large-list performance remain manual checks.
- Existing Vite/esbuild advisories remain unresolved. A comprehensive backend dependency vulnerability audit was not executed; no clean-security-audit claim is made.
- Production migration lock duration, Neon restore entitlement, Render readiness, production CORS, deployment logs and live authenticated persistence have not been verified in this task. They are required release checks, not inferred from local success.
- No push or deployment is authorized by this request. Follow the migration-first runbook and obtain explicit release authorization before touching production data or triggering auto-deploy.
