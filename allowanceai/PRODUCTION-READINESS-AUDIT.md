# AllowanceAI Intelligent Budgeting — production-readiness audit

**Audit date:** 30 October 2026, Africa/Johannesburg.  
**Decision:** **NO-GO for production release in its present form.** Passing the existing tests does not establish production readiness. Several financial-integrity and workspace-state defects were reproduced, and production migration compatibility has not been established.

This is an audit, not an implementation change. No application source, dependencies, deployment configuration, credentials or existing financial records were changed. Only this report was added. Build outputs/caches and disposable audit scripts/databases were generated locally. All database writes during verification were confined to newly created loopback-only PostgreSQL test schemas or a disposable local SQLite API; those fixtures were cleaned up. Production checks were unauthenticated, read-only HTTP requests.

## Scope and evidence boundaries

- Reviewed the actual uncommitted working tree on `main`, based on commit `ca094173e2d8fd99cf03ae7e353d491b92ccef4a`. The Intelligent Budgeting files are not yet an immutable release commit.
- Inspected both Alembic revisions and frozen schemas, migration environment, SQLAlchemy configuration/models, financial CRUD/heuristics, item/category/purchase service, authentication/ownership dependencies, frontend item workspace/analytics/API client and deployment artifacts.
- Reran the existing PostgreSQL suite and build. Ran additional fault, concurrency, migration-shape, rounding, cross-month and browser-navigation probes without altering application code or repository tests.
- **Verified** below means directly observed in source and/or reproduced against these local fixtures. **Risk/inference** means a consequence supported by code but not observed on the production database. **Unverified** means provider/database evidence was unavailable or deliberately not accessed.
- Production Neon schema, actual Alembic revision/history, connection options, privileges, backup/restore entitlement, Render settings/logs and Vercel environment values were **not inspected**. No inference of an empty or baseline-compatible production database is justified.

## Prioritized findings

### R1 — P1 / release blocker: baseline adoption accepts materially incompatible schemas

**Verified:** `backend/migrations/versions/0001_legacy.py:10` checks required column names, primary-key column sets and foreign-key column/table names. It does **not** validate column types, nullability, email uniqueness, indexes, defaults/sequence ownership, foreign-key validation/actions or referred schema. It creates missing baseline tables rather than proving the existing application schema is complete.

**Reproduction:** In a fresh isolated PostgreSQL legacy schema, removed the unique email index, made `users.email` nullable and made `categories.user_id` nullable. `alembic upgrade head` still succeeded and recorded `0002_item_ledger`; the missing protections remained. This is not evidence that production has those defects. It proves that a successful baseline upgrade cannot rule them out.

**History compatibility:** `0001_legacy` is a new root (`down_revision=None`). With an unrelated existing `alembic_version` value, upgrade stops with `Can't locate revision identified by 'existing_external_revision'`. This is a safe failure, not an automatic history merge or data deletion. The actual production history remains unknown. Already stamping `0001_legacy` also skips its checks on later upgrades; a version stamp is not a schema-equivalence certificate.

**Recommended fix / release gate:** Obtain a read-only production schema/history inventory. Validate types, nullability, unique constraints, schema-qualified/validated FKs, indexes, defaults, sequence positions, duplicate emails/budgets, orphan ownership and non-finite monetary values. Define explicit adoption paths for (a) no version table, (b) the expected chain, (c) unrelated/multiple heads, and (d) partial/drifted schemas. Fail closed on unexplained differences. Preserve any real existing history; do not delete its version table or blindly stamp `head`. Rehearse on a securely isolated copy of the actual production schema/data before authorizing migration.

### R2 — P1 / release blocker: legacy financial writes and analytics are not one serialized transaction

**Verified:** `backend/crud.py:796`, `:834`, `:863` commit manual expense creation/update/deletion **before** calling `rebuild_behavior_tracking`. That helper (`:553`) deletes and reinserts derived rows without the shared purchase service's user-row lock or unique daily-summary keys. Startup (`backend/main.py:144`) also rebuilds each user's logs. The new `item_service.atomic` lock serializes ledger writers, not every legacy writer/startup rebuild.

**Reproductions:**

1. Injected an analytics-refresh failure after manual expense creation: the request raised an error, but an expense of **10** was already committed. A user retry can create another manual expense. The new purchase service's rollback test does not cover this path.
2. Ran two existing analytics rebuilds simultaneously, synchronizing their deletion of initially empty cache tables. A single source expense of **10** produced **two daily cache rows totalling 20**. The source expense total remained 10. This demonstrates incorrect derived analytics, not a duplicated purchase expense. Other interleavings involving existing rows may block/deadlock; those interleavings were not exhaustively tested.

**Recommended fix:** Use the same per-user serialization and transaction boundary for every source financial write and its derived updates. Add appropriate unique keys/upserts or derive summaries from authoritative expense rows. Remove or serialize startup rebuilds, including overlapping deployments/workers. Add concurrent manual/manual, manual/purchase, startup/purchase and failure-after-source-write regressions. Define safe retry handling for deadlocks and serialization failures.

### R3 — P1 / release blocker: monetary reconciliation is not exact across supported APIs

**Verified:** New purchase amounts use Decimal and per-line ROUND_HALF_UP (`backend/item_service.py:29`), but existing monetary models use `Numeric(asdecimal=False)` (`backend/models.py:15–87`), legacy request/response schemas use floats (`backend/schemas.py:7`, `:43`), and legacy reports round floats. NUMERIC storage alone does not make those API/heuristic calculations Decimal-based.

**Reproductions on PostgreSQL:**

| Accepted input | Observed result |
|---|---|
| Two manual expense amounts of 0.015 | Expense API returned 0.01 + 0.01; budget summary returned 0.03. Displayed records do not reconcile with the summary. |
| Quantity 999999 at actual unit price 9999999999.99, within current validators and purchase-total guard | Purchase ledger and raw stored expense both contained **9999989999990000.01**; expense API/budget summary returned **9999989999990000.0**, losing a cent. This is an accepted-range boundary case, not a typical household amount. |

**Recommended fix:** Specify one monetary precision, finite-value policy, rounding point and supported amount range for all entry paths. Preserve Decimal through expense storage, calculations and API serialization; reject new sub-cent/non-finite inputs where not supported. If compatibility floats remain, bound accepted amounts to a range that round-trips safely and explicitly version/document the contract. Reconcile migrated historical sub-cent values through a reviewed policy rather than silently rewriting records. Test equality between purchase lines, raw expenses, expense API totals, category totals and budget/report totals.

### R4 — P1 / release blocker: direct navigation retains the wrong item workspace

**Verified:** `Dashboard.jsx:179` and `:234` render the same `ItemWorkspace` component without distinct keys. Its `[kind]` effect (`ItemWorkspace.jsx:61`) reloads lists/categories but does not clear the selected plan, form, selection or confirmation state.

**Browser reproduction:** Opened a saved monthly plan containing “Monthly rice audit”, then clicked Shopping lists directly in the sidebar. The URL became `/app/shopping-list`, but the monthly item and monthly plan name remained in the shopping interface. Saving settings sent the monthly plan ID with `kind=shopping` and received **422: Plan type cannot change.** Purchases are addressed by the retained plan ID, so presenting the wrong plan is a financial-action risk even though it is not a cross-user access bypass.

**Recommended fix:** Key the workspace by kind/identity or comprehensively reset state on a kind change, cancel stale requests and invalidate any reviewed confirmation. Add monthly→shopping→monthly tests that preserve/clear drafts and selections intentionally. Existing browser workflows navigate through other component types/full page loads and miss this transition.

### R5 — P1 / release blocker unless explicitly constrained: month-specific plans change all months' category allocations

**Verified:** Categories have no month or budget FK. `get_total_planned` (`crud.py:549`) always sums the same user-wide category limits; `apply_budget` (`item_service.py:301`) writes those limits regardless of the plan month.

**Reproduction:** The current October 2026 category allocation was 300. Applying a January 2027 monthly plan changed the current month's planned total to **50**, while saving the budget under January 2027. This is existing shared-allocation semantics exposed by the new apply action, not a changed expense or account ownership.

**Consequences:** Editing future/past plans changes present category remaining amounts, utilization, alerts and recommendations. Historical/month-comparison analysis can compare past expenses against today's category limits. Applying a plan does not zero allocations for removed/omitted categories, so totals may exceed the plan's own grouped total. Repeated application replaces included values rather than double-adding them, which is correct, but it does not isolate months.

**Recommended fix:** Approve a clear model: month-specific allocation records/snapshots, or an explicit restriction of the current apply action to the current month with clear shared-template semantics. Until then, do not market it as isolated monthly allocation management. Test current→future→historical application and omitted categories. Existing records must not be deleted to solve this.

### R6 — P1 / verification and API-contract blocker: test session settings mask a legitimate batch failure

**Verified:** Production `SessionLocal` sets `autoflush=False` (`database.py:18`); the fixture uses `sessionmaker(..., expire_on_commit=False)` with default `autoflush=True` (`tests/test_workspace.py:52`). Exact dependency pins do not correct this configuration difference.

**Reproduction:** Adding two same-named Rice rows with the same explicitly chosen existing category in one supported item batch returned **200** under the fixture's default setting and **409** under production's setting. `category_engine.assign` queries preferences without flushing/consulting pending preferences, so repeated manual corrections in the transaction collide with the user/product unique key. The whole transaction rolls back; no duplicate expenses were observed. The message incorrectly suggests an external concurrent change.

**Recommended fix:** Align fixture session/autocommit/expiry/isolation options with production. Make preference reuse safe for repeated entries within one transaction. Add repeated products with different package sizes/priorities, explicit categories and corrected preferences to bulk tests. The existing 100-row scenario uses distinct names and dictionary categorization, so it does not cover this failure.

### R7 — P2 / security remediation required: two vulnerable development-tool packages remain

**Verified:** Fresh `npm audit --json` reports **esbuild moderate** and **Vite high**. These are two affected package entries, not just two individual advisory records. Installed versions are **Vite 5.4.21**, **esbuild 0.21.5**, and **@vitejs/plugin-react 4.7.0**. No package/lockfile changes were made.

- esbuild's reported development-server cross-origin disclosure is fixed in **0.25.0+**. See the [maintainer advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99).
- The current high-severity Vite Windows launch-editor advisory lists **6.4.4** as a fixed Vite 6 release; there are also path/command-handling advisories in the aggregate report. See [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm). Vite 5 is outside the [currently supported release lines](https://vite.dev/releases).
- Registry metadata confirms **Vite 6.4.5** exists and depends on `esbuild ^0.25.0`. The installed React plugin declares Vite 6 compatibility. This is a smaller supported migration candidate than npm audit's suggested **8.3.5**. It is **not installed, built or security-validated as an upgrade during this audit**; a clean regenerated lockfile audit is still required. Vite 8 changes its build toolchain and exceeds the current plugin's declared peer range; review its [migration guide](https://vite.dev/guide/migration) if chosen instead.

**Exposure distinction:** The reviewed Vercel architecture serves built static assets; it does not require running a Vite/esbuild development server in production. No exploit of the live static site was demonstrated. Developer/preview servers and build infrastructure still warrant remediation; localhost alone does not eliminate every reported browser-to-local-server risk.

**Recommended fix:** In a separate reviewed dependency change, test the latest appropriate patched supported Vite line, preserve plugin/Node compatibility, regenerate the lockfile, run clean install/build/browser/PWA checks and rerun the audit. Do not blindly use `npm audit fix --force` or override esbuild independently of Vite compatibility. Keep development servers inaccessible to untrusted networks in the meantime.

### R8 — P2: expected-remaining forecast can overstate available money after partial cancellation

**Verified:** `serialize` excludes the full estimate of skipped/cancelled items but calculates `expected_remaining` from allowance minus savings minus active estimates (`item_service.py:87–128`). The UI labels that field “Expected remaining”. Actual totals are preserved separately.

**Reproduction:** Allowance 1000, savings 100, buy two of three bags for 64.20, then cancel the item: displayed expected remaining becomes **900**, while actual cash after purchases and savings is **835.80**. Even before cancellation, changed actual prices are not folded into that planning estimate. No expense was lost; the forecast semantics are misleading.

**Recommended fix:** Distinguish original-plan remaining from projected remaining after actual purchases and pending estimates. For the latter, use allowance − reserved savings − actual purchases − pending estimate. Define whether cancellation applies only to the unpurchased remainder. Add assertions for this exact scenario and revise labels accordingly.

### R9 — P2: recovery and scale guarantees stop short of operational production needs

**Verified code limitations / unverified operational behavior:**

- Idempotency is durable on the server for the **same user/key/payload**; a new key is a new operation. The UI generates a key at preview and retains it only in memory (`ItemWorkspace.jsx:225`). After an uncertain response and page close/reload, a new partial purchase can use a new key and buy the same quantity again if enough remains. This is a retry/recovery gap, not a bypass of the existing unique key.
- There is no audited reversal/correction flow for a confirmed purchase. Direct expense edits/deletes correctly fail, but an entry error needs a defined support/recovery policy before broad real-money use.
- `GET /api/plans` serializes every item and purchase history for every own plan. There is no pagination or batch size limit; per-item/category checks and all-history cache rebuilds grow with data size. The 100-item tests do not establish latency, memory, lock-wait or request-timeout limits for large histories.
- `database.py:16` does not configure pre-ping, connection timeout, pool recycling or a transaction retry policy. TLS depends on the actual DATABASE_URL. Neon idle/stale-connection behavior, deadlock recovery and secret/role least privilege are not verified by a localhost success.
- Purchase-date validation uses backend `date.today()`, while the browser uses local dates. UTC/Lesotho midnight boundaries and monthly purchases spanning dates/months are untested. Plan actuals sum all linked purchase dates; dashboard budget totals are month-filtered. Those are different valid scopes, but need explicit labels/tests.

**Recommended fixes / gates:** Preserve/recover pending confirmation identity safely, reconcile after unknown outcomes, define an auditable correction procedure, add load/timeout/pool tests and clarify date/period semantics. Keep production retry policy bounded and reuse the same confirmation key after unknown outcomes.

## What is working, with limits

- **Verified locally:** server-side Decimal item multiplication and cent rounding, package-size/count separation, partial purchase preservation, actual-price differences, explicit zero-allocation categories, user-specific corrections, no expense on plan/list save/evaluation and no automatic financial seeding.
- **Verified locally:** `confirm_purchase` locks the authenticated user's row, checks ownership/version/remaining quantities, rejects duplicated item selections, hashes canonical request contents, and uses a user/key unique constraint. Same-key concurrent requests replay one event; competing different-key requests with stale versions cannot over-purchase. New expense rows, purchase lines, event, version and derived log updates are in the same transaction; injected failure rolls these back. These guarantees apply to that path, not all legacy writes.
- **Verified locally:** each purchase line has one unique expense link. Existing budget totals query expense rows; plan estimates and purchase-line totals are not added to those expenses again. Linked expenses reject direct edit/delete. Plan-level actuals count linked lines once. Precision and derived-cache defects in R2/R3 remain.
- **Verified for tested API cases:** plan/item/category ownership filters and authentication/admin dependencies prevent the tested cross-user accesses. No cross-user disclosure was reproduced. There is no demonstrated PostgreSQL RLS or composite ownership constraint enforcement; app authorization remains the boundary. This was not an exhaustive penetration test.
- **Verified locally:** migrations preserve the small tested legacy fixture and repeat safely after successful application; PostgreSQL DDL failure rolls back in the tested transaction. Destructive downgrade is blocked. These checks do not prove production schema equivalence, acceptable table-lock duration or backup restoration.

## Production/configuration observations

Read-only production checks during this audit:

| Check | Observed result | What it does not prove |
|---|---|---|
| Render `/health` | HTTP 200 | Schema or financial API correctness |
| Render `/ready` | HTTP 200 | Only a `SELECT 1` readiness check; no proof of ledger migration/schema/history |
| Production-origin login CORS preflight | HTTP 200, exact `https://allowance-ai-omega.vercel.app` allowed, credentials enabled | Every provider environment/origin configuration |
| Vercel `/version.json` | **1.3.0** | Local prepared 1.4.0 is not deployed |
| Render public OpenAPI | Existing budget/shopping endpoints present; **`/api/plans` absent** | No Intelligent Budgeting production workflow verification is possible yet |

The previous task's Render timeout is not current evidence: it responded during this audit. The old API and the new frontend are not a compatible deployment pair for item functionality. Frontend-first deployment would expose failing item requests.

Reviewed configuration: backend Procfile launches Uvicorn, frontend uses the approved Render API fallback in production, and Vercel SPA rewrites are present. No committed Render Blueprint/predeploy migration step was found. Actual Git integration settings, root/build/start directories, auto-deploy ordering and production variables require provider verification. `CORS_ORIGINS` is not read by the reviewed backend; it uses its explicit list plus `FRONTEND_URL`. Do not assume setting that unused variable changes allowed origins.

PostgreSQL startup compares one scalar version row with `0002_item_ledger`; it will fail before readiness if that value is missing/wrong. It does not validate singleton history, all heads or schema equivalence; extra version rows could be overlooked when the first selected row matches. `ALLOWANCEAI_TEST_CREATE_SCHEMA` must never be enabled in production. Local backend environment metadata points to loopback PostgreSQL; its settings are not evidence of Neon TLS or credentials. No passwords, tokens or connection strings are included here.

## Verification executed and test adequacy

| Verification | Audit result |
|---|---|
| Unchanged PostgreSQL suite via `tests/run_local_postgres.py` | **26/26 PASS**, pinned production framework/driver versions plus Alembic, only new guarded local schemas |
| Same unchanged suite with temporary production-like `autoflush=False` fixture override | **26/26 PASS**; the separate repeated-preference batch still fails, demonstrating missing coverage |
| `npm run build` | PASS, 873 modules, no deployment |
| Python compileall / `git diff --check` | PASS |
| Currency unit test | PASS; proves display preference behavior for its cases, not exact money handling at all ranges |
| Existing browser smoke / PWA install suites | PASS; public/auth/workspace smoke and installation lifecycle checks. Older browser API responses and native-install events are mocked |
| Additional PostgreSQL probes | Confirmed R1/R2/R3/R5/R6/R8 with disposable rows only |
| Additional browser probe against disposable real local API | Confirmed R4; no production login/account/financial writes |
| Fresh registry audit | Completed with TLS/system trust, exit 1 for the two affected packages; no fixes applied |
| Live HTTP checks | Existing release health/readiness/CORS succeeded; version 1.3.0 and no item routes |

Existing tests adequately exercise normal new-ledger CRUD, zero defaults, basic ownership, 65-of-100 partial purchasing, same-path concurrency and rollback. They **do not adequately cover production adoption or failure recovery**. Missing/insufficient cases include:

1. Actual production schema/history clone, unknown/multiple Alembic heads, already-stamped drift, missing unique/nullability/schema-qualified/unvalidated FK constraints, sequence positions and representative legacy data scale/non-finite values.
2. Exact production session configuration and repeated same-product confirmed preferences in a bulk transaction.
3. Manual writes mixed with purchases, simultaneous cache rebuilds/startups, crash after legacy source commit, lock timeouts and retry behavior.
4. Cross-month allocation application, omitted categories and historical category snapshots.
5. Sub-cent legacy inputs, full accepted monetary ranges and exact reconciliation across raw database/new ledger/legacy APIs/reports.
6. Direct React monthly/shopping navigation without an intervening unmount, in-flight responses, retained selection and confirmation identity.
7. Dropped response after commit, page/browser restart and replay, validated forward repair/backup restore, and a confirmed-purchase correction procedure.
8. Real PostgreSQL browser workflow on a migrated production-shaped clone rather than ORM-created tables, multi-worker deployment overlap, large-history performance and device/time-zone checks.

The test fixtures' destructive cleanup is restricted to their newly created local schemas. No production migration, restore or load test was attempted.

## Safe deployment sequence after fixes are separately authorized

1. **Hold release.** Resolve R1–R6 or explicitly approve a tightly constrained scope that removes the unsafe paths. Approve correction/recovery policies. Remediate or formally assess development-tool findings; do not claim an audit pass while they remain.
2. **Create a reviewable immutable release.** Preserve the current working tree, implement reviewed fixes in a feature branch in a separate task, add the missing regressions, review all migrations/diffs/secrets, commit and run CI on the exact candidate SHA. Do not push this uncommitted implementation directly to an auto-deploy production branch.
3. **Read-only provider/database inventory.** Confirm the dedicated Neon identity, selected schema/search_path, actual Alembic history, table/constraint/sequence/data compatibility, roles/TLS/pooling, Render start/build/root settings and Vercel API origin. Preserve credentials; do not rotate or replace databases to work around adoption errors.
4. **Back up and rehearse recovery.** Confirm the actual Neon plan's restore window/entitlements, take an authorized backup/snapshot and prove restore on an isolated copy. Do not assume a specific retention period. Rehearse migration failure and forward repair/old-app compatibility; do not rely on the intentionally disabled destructive downgrade.
5. **Staging rehearsal.** Restore a securely isolated production-shaped copy; apply the exact release migration with the real deployment role. Verify schema, counts, hashes, ownership, sequence behavior and exact financial reconciliation, then exercise backend+browser flows, concurrency, dropped responses and load. Do not seed demo records into production.
6. **Approve a maintenance window and release plan.** Float-to-NUMERIC alterations can rewrite/lock tables; measure this in rehearsal. Define lock/statement timeouts, failure abort conditions and how to pause writes. Stop competing legacy writers/startup rebuilds during conversion. Verify auto-deploy does not start new code before migration or expose new UI against the old API.
7. **Apply the reviewed migration through an explicitly authorized deployment mechanism.** Use the securely configured backend environment; verify expected version/schema before and after. Preserve all existing Alembic history. On mismatch or failure, stop; do not stamp around the failure or drop tables. No production command was executed by this audit.
8. **Deploy backend before frontend.** Verify exact SHA, health, readiness, schema-aware authenticated checks, authorization, CORS and reconciliation. Ensure old frontend/manual expense paths remain compatible. Avoid unsafe overlapping writers; do not enable test schema creation.
9. **Deploy frontend after backend verification.** Preserve approved API URL, version/cache alignment and SPA routes. Verify direct monthly↔shopping transitions, unknown-outcome retries, PWA update/offline handling, desktop/mobile and existing accounts.
10. **Observe and reconcile.** Monitor errors, pool/lock waits, replay/conflict rates and source-versus-derived totals. Verify real persistence under an explicitly authorized test procedure. If rollback is needed, prefer a compatible previous application artifact/forward repair; do not erase legitimate new purchases with an unreviewed database restore.

**Readiness recommendation remains NO-GO until the documented blockers are addressed and production-specific gates are verified.** No new features or fixes were implemented as part of this audit.


## Remediation verification — 30 October 2026

The preceding sections are the historical **before** audit, retained intact. This appendix records the local **after** state. See [READINESS-REMEDIATION.md](READINESS-REMEDIATION.md) for root causes, changed files, API/migration semantics, recovery procedure and remaining gates.

**Current recommendation: NO-GO for production.** Local verified defects have code fixes and independent outcome regressions, but the actual Neon schema/history and restore rehearsal have not yet been verified. The owner is arranging a read-only connection. No deployment, production migration/data change, credential rotation, commit or push was performed.

| Finding | Before | After / verified local evidence |
|---|---|---|
| R1 | Baseline accepted missing email uniqueness/nullable ownership; unrelated history unsupported | Empty vs complete vs partial adoption is explicit; required types/nullability/index/unique/FK/sequence/ownership/data checks fail closed. Unknown/multiple heads and stamped drift reject; revision-aware ledger checks include expense reconciliation. Clean/populated upgrades preserve original source records. Actual production adoption remains gated |
| R2 | Failed manual request persisted source; concurrent cache could double | Shared per-user lock and one commit after complete financial action/response serialization; all failures roll back. Rebuilds serialize, startup rebuild removed, live analytics reads sources. Mixed concurrent manual retry/purchase/rebuild yields 2 expenses and one exact daily 74.20 total |
| R3 | 0.015 new inputs and large floats produced mismatched totals | New sub-cent/nonfinite/out-of-range writes reject; Decimal/exact-string money throughout APIs, source calculations and financial formatting. Historical 0.015 is untouched and reconciles as 0.015. Previously failing 9999989999990000.01 boundary remains exact |
| R4 | Monthly plan appeared in shopping view, wrong-kind save failed | Keyed workspace identity; direct navigation, back/forward, refresh and selection isolation verified in a separate real API browser test |
| R5 | Applying future month changed current allocation 300→50 | `0003_month_allocations` adds unique user/category/month rows. Current 300, prior 200 and future 50 stay independent; no actual expenses created. Legacy snapshot provenance states historical uncertainty rather than inventing history |
| R6 | Repeated corrected-product batch failed only under autoflush=False | Explicit dependent preference flush; full PostgreSQL suite runs in both modes with production expiry/autocommit settings, including repeated-product regression |
| R7 | Vite high/esbuild moderate audit findings | Vite 6.4.5 / esbuild 0.25.12 / React plugin 4.7.0; fresh npm audit reports **zero vulnerabilities**. Build/browser/PWA checks passed; no comprehensive backend-security-audit claim |
| R8 | Partial cancellation showed remaining 900 despite actual 64.20 | Projected remaining includes actual + pending; cancellation retains actual 64.20 and shows 835.80 with no pending estimate |
| R9 | In-memory confirmation key lost on refresh; manual creates lacked retry key | Per-user session recovery plus durable manual operation keys. Real browser commits, loses response, reloads and retries purchase/manual expense without duplicate records. Provider/load/physical-device/reversal limitations remain documented |

Verification completed during remediation:

- PostgreSQL full suite: **40 tests pass with autoflush=False and 40 with autoflush=True**, using pinned production framework/driver versions in guarded new loopback schemas. The final matrix includes API purchases on a migrated populated historical schema and preservation of original expense values.
- SQLite full suite: **40 tests, PASS with four explicit PostgreSQL-only skips**. No PostgreSQL concurrency/NUMERIC guarantees are inferred from SQLite.
- Real item browser workflow: save/reopen, explicit allocation apply, partial actual-price purchase, all five responsive widths and **100 items / 65 purchased / 35 pending** pass.
- Separate remediation browser suite: direct workspace transitions, history navigation, reload, purchase and manual expense lost-response/retry scenarios pass; server records remain singular.
- Legacy workspace E2E, all retained routes/charts/admin denial, public/auth/browser smoke, two currency tests, PWA install lifecycle and built offline/direct-route checks pass. Mocked native installation events are not physical-device evidence.
- Patched Vite production build, Python compilation and diff checks pass. Fresh npm audit exits zero with no reported vulnerabilities.
- All verification writes were confined to disposable SQLite databases and guarded new local PostgreSQL schemas. No real financial rows were reset or rewritten. The local backend/database/deployment configuration never supplied Neon credentials.

Release gates still open: authorized read-only Neon schema/history/identity comparison, restore rehearsal on an isolated production-shaped copy, migration lock timing/role/TLS/pool checks, exact reviewed release commit and explicitly authorized backend/migration/frontend release sequence. Do not relabel the application production-ready based on local tests alone.
