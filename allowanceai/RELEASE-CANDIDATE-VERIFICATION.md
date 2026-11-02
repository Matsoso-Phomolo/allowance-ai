# AllowanceAI — Phase 8 release-candidate verification

Date: 30 October 2026 (Africa/Johannesburg). **Decision: NO-GO.**

Local financial, migration-fixture and browser regressions pass. Actual Neon identity/schema/history compatibility and a production-backup restore rehearsal remain unverified. A fresh backend dependency audit also found unresolved advisories. This package does not authorize release. No production connection, migration, data change, credential rotation, deployment, merge or push was performed.

## 1. Candidate identity and reproducibility

- Branch: `codex/phase8-release-candidate-20261030`, created without resetting or discarding existing work.
- Base revision: `ca094173e2d8fd99cf03ae7e353d491b92ccef4a`.
- The implementation remains **uncommitted**. The base SHA alone does not identify the candidate. Nothing is staged; no immutable release commit is claimed.
- `RELEASE-CANDIDATE-SOURCE-MANIFEST.json` records SHA-256 hashes of 116 tracked/nonignored source and text files, including the implementation, migrations, lockfile, tests and prior reports. It excludes binary visual assets and this report/manifest to avoid circular hashes. Manifest SHA-256: `ef6aa5a169ef2d3b20973fa155aa28ee31fa81f95d4417944e5365798e7b5e54`.
- `RELEASE-CANDIDATE-PYTHON-DEPENDENCIES.txt` records the exact installed Python runtime package versions. Frontend resolution is recorded by `frontend/package-lock.json`. These identify the tested environment; a clean-machine installation has not been rehearsed in this stage. Do not assume the floating transitive backend requirements independently recreate it.
- A source-only archive was created outside Git at `C:\Users\WINDOW~1\AppData\Local\Temp\allowanceai-rc-20261030-e75c930086ea45ed91bdcf0aff832bb6.zip`, containing all 116 verified source entries plus the manifest. SHA-256: `8f9a90e4ca44ff0980b4ab3d2ed75a06c1fd7daedcc8b4ce9f5cc50fc59712e4`. This preserves the tested source snapshot without committing or staging generated artifacts. It excludes credentials, runtime/build output, binary visual assets and this later release report. Temp storage is not durable backup; retain the artifact securely outside source control before cleanup if needed.
- Existing untracked desktop/mobile screenshots are visual evidence, excluded from the source manifest and not staged. Test output, temporary databases, virtual environments, node_modules and dist remain outside the candidate source list.

### Change inventory

The pre-existing implementation and remediation are preserved, not replaced. See READINESS-REMEDIATION.md for detailed root causes and changed files. Candidate changes cover:

- Item-ledger/category services, models, schemas, routes and transactional financial helpers; existing CRUD, calculations, authentication-compatible API integration and database pooling.
- Three Alembic revisions, frozen schemas, fail-closed adoption validation and an explicit read-only inspection utility.
- Monthly allocations, exact decimal-string money contracts, manual-operation idempotency, atomic purchase/expense reconciliation and recovery state.
- Item workspaces/analytics, financial forms/reporting/currency formatting, distinct monthly/shopping navigation and session-scoped retries.
- Vite/lockfile, prepared version/service-worker cache metadata, regression tests and deployment/audit documentation.
- This phase adds only release evidence documents/manifest/dependency inventory. No additional product features or deployment configuration changes.

### Runtime versions

Python 3.11.0; FastAPI 0.111.0; SQLAlchemy 2.0.30; Pydantic 2.7.4; psycopg2-binary 2.9.9; Alembic 1.13.1; Uvicorn 0.30.1; HTTPX 0.28.1. Node 24.19.0; npm 11.17.0; React 18.3.1; React Router DOM 7.18.5; Vite 6.4.5; esbuild 0.25.12; React Vite plugin 4.7.0; Recharts 2.15.4. Dependency compatibility: `pip check` passed.

## 2. Production database compatibility — BLOCKED, not inspected

No connected Neon tool was available in this session. No securely injected production DATABASE_URL was present; the known local configuration is loopback PostgreSQL. It was used only by the guarded disposable-schema test runner, never substituted for production evidence. No production connection was attempted.

Expected provider identifiers supplied by the owner (not independently verified): project `royal-hill-71285700`, production branch `br-patient-voice-b4tgg6yw`, database `neondb`, organization `org-red-tree-39733852`. Expected schema/search_path, actual tables, column types, constraints, indexes, foreign keys, sequences, ownership, financial values and Alembic history are **unknown**.

Stage 2 stopped at the access boundary. Required next evidence: authorized provider identity mapping, then read-only schema/history comparison using securely supplied credentials. `backend/inspect_schema_readonly.py` explicitly sets transaction READ ONLY and a 15-second statement timeout, does not load .env, and does not print credentials. Its successful output alone does not prove provider identity or backup readiness. Do not run migrations or stamp history as part of inspection.

### Reviewed migration chain

`base → 0001_legacy → 0002_item_ledger → 0003_month_allocations`.

- 0001 distinguishes truly empty, complete compatible and partial/incompatible legacy schemas. Required types/nullability, uniqueness, foreign keys, indexes and PostgreSQL sequence state are validated; unexplained history fails closed.
- 0002 adds five item-ledger tables and converts legacy monetary columns to unbounded NUMERIC, preserving historical sub-cent values. Conversion can lock/rewrite tables; production duration remains unmeasured.
- 0003 adds category/month allocations and durable manual expense-operation records. Existing shared category amounts are copied to known months with `legacy_snapshot` provenance; they are not reconstructed original monthly history. Source records are not overwritten.
- Known stamped schemas are revalidated. Unknown/multiple heads or drift must not be worked around by deleting history, stamping head or dropping tables. If production has a previously applied different revision body, compare it explicitly before any release.
- Destructive downgrades are intentionally disabled. A compatible forward repair or proven restore procedure is required.

## 3. Verification rerun in this phase

All test writes were confined to new UUID-named loopback PostgreSQL schemas or disposable SQLite databases. Existing production records were not used. The fixture verifies loopback server identity before creating test schemas and cleans up only its own objects.

| Check | Actual result |
|---|---|
| Complete PostgreSQL suite, autoflush=False | 40/40 PASS; 49.139 seconds |
| Complete PostgreSQL suite, autoflush=True | 40/40 PASS; 66.374 seconds |
| Complete SQLite suite | 40 run; 36 passed, four explicit PostgreSQL-only skips; 23.416 seconds |
| Real item browser suite | PASS; save/reopen, apply allocations, partial purchases, linked expenses/analytics, five widths, 100/65/35 and persistence |
| Separate remediation browser suite | PASS; direct navigation, back/forward/deep-link refresh, purchase/manual commit-lost-response-reload-same-key retries |
| Existing workspace browser suite | PASS; zero state, financial CRUD, monthly editing, refresh/login persistence, user isolation, retained modules/charts/admin denial |
| Browser smoke | PASS; public/authenticated navigation, safe redirects, currency, budget status, mobile and logout; API fixtures mocked |
| Currency unit tests | 2/2 PASS; exact large/sub-cent strings and HALF_UP estimate |
| PWA installation suite | PASS; eligibility, dismissal/recovery, standalone suppression, instructions/focus/mobile; native events mocked |
| Built PWA smoke | PASS; service worker, manifest, cached offline homepage and direct Help route |
| Frontend production build | PASS; Vite 6.4.5, 692 modules |
| Python compilation / diff whitespace | PASS |
| Backend dependency consistency | `pip check`: no broken requirements |
| Fresh npm audit | Exit 0; zero reported vulnerabilities |
| Fresh installed-backend pip-audit 2.10.1 | Exit 1; findings in four packages; details below |
| Actual Neon inspection / production-shaped restore | NOT RUN; access and approved backup unavailable |

Outcome regressions cover failed source/derived writes and rollback, serialized mixed concurrent operations, purchase/manual retry identity, Decimal boundary `9999989999990000.01`, preserved historical `0.015`, rejected invalid new money, monthly 300/200/50 isolation, cross-user records, production-equivalent sessions, batch explicit flushes, category preference corrections and migrated historical-fixture API purchases. These are local evidence, not a production load test or third-party audit.

Commands: in backend, run `python -X utf8 tests/run_local_postgres.py` separately with `WORKSPACE_TEST_AUTOFLUSH=0` and `=1`; run `python -X utf8 -m unittest discover -s tests -p "test_*.py"` without WORKSPACE_TEST_POSTGRES_URL for SQLite; `python -m compileall -q .`; `python -m pip check`. Use the pinned runtime/dependency inventory. The PostgreSQL runner refuses non-loopback credentials.

In frontend: `npm run build`, `npm audit --json`, `node --test tests/currency.test.cjs`, and each of the six browser scripts in `frontend/tests` (items, remediation, workspace, browser smoke, PWA install, built PWA). Real browser suites require the disposable `backend/tests/serve_workspace_test.py` on 8001, Vite on 5173 with local VITE_API_BASE_URL, preview on 4173 for built PWA, and Playwright/Edge. Never point these write-producing tests at production. Test runners currently obtain Playwright from the desktop bundled runtime; it is not declared by the frontend package.

## 4. Security and configuration evidence

Candidate path review found zero database/dump/virtualenv/cache/build/private-env paths. A high-confidence scan of candidate text for credential-bearing PostgreSQL URLs, private keys, GitHub tokens and AWS access-key patterns found zero matches. This is a scoped scan, not proof that every possible secret format is absent. Nothing is staged. Deployment files/credentials were not changed by this phase.

The first npm audit failed certificate trust; retry with Node `--use-system-ca` succeeded with TLS verification enabled. No trust bypass or force upgrade was used. Zero npm findings does not certify application security or backend dependencies.

### Newly verified backend advisory gate

An isolated pip-audit 2.10.1 installation outside the application environment audited the pinned test runtime using `python -m pip_audit --path <test-runtime>/Lib/site-packages --format json`. The initial audit-tool installation failed certificate trust; retry used a PEM export of Windows trusted CA certificates with PIP_CERT/REQUESTS_CA_BUNDLE, keeping TLS verification enabled. No application dependency was upgraded.

The scanner exited 1, reporting **39 advisory records in four packages**. Repeated advisory IDs occur in the raw response; the sanitized `RELEASE-CANDIDATE-BACKEND-AUDIT.json` deduplicates them to **20 package/advisory-ID pairs**, not 39 distinct confirmed vulnerabilities. Scanner results are evidence of affected installed versions, not proof of reachable production exploits or severity for every entry.

| Package | Installed | Unique advisory IDs | Scope / action required |
|---|---|---|---|
| Starlette | 0.37.2 | 7 | Runtime transitive dependency. Maintainer confirms high multipart DoS GHSA-f96h-pmfr-66vw, patched 0.40.0, and additional multipart/file DoS GHSA-2c2j-9gv5-cj73, patched 0.47.2. Other scanner entries require triage; see JSON. Current FastAPI 0.111.0 metadata requires Starlette >=0.37.2,<0.38.0, so forcing a new Starlette pin alone breaks the declared compatibility range. Assess a coordinated FastAPI/Starlette upgrade and rerun all regressions |
| python-dotenv | 1.0.1 | 1 | Direct pinned runtime dependency. GHSA-mf9w-mj56-hr94 reports set_key symlink/file-overwrite behavior; patched 1.2.2. Reachability through this application has not been demonstrated; review usage and upgrade compatibly |
| pip | 22.3 | 7 | Local installation tooling, not a declared runtime application dependency. Update/rebuild the build/test toolchain and audit the actual production image separately |
| setuptools | 65.5.0 | 5 | Local build/installation tooling. Same separation from runtime exposure; use a reviewed patched toolchain |

Primary corroboration: [Starlette multipart advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-f96h-pmfr-66vw), [Starlette large-file advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73), [python-dotenv advisory](https://github.com/advisories/GHSA-mf9w-mj56-hr94). The machine-readable evidence lists all scanner IDs and suggested fixes; these are not an approved upgrade plan. No zero-critical or clean-backend-security assertion is justified until triage/remediation is complete. This is an additional release gate, not silently waived because financial tests pass. No dependency remediation was performed in this verification-only phase.

The backend audit JSON and this report are later verification evidence, outside the earlier 116-file source snapshot. They do not modify the tested application source.

Production configuration remains unverified: exact Render/Vercel branch/root/build/start/migration ordering, secret values, TLS/role/pool behavior and backup plan. Existing code expects exact decimal-string money responses; bundled UI is updated, but external numeric-JSON clients require compatibility review. Test schema creation must remain disabled in production. The local .env.example is a development example, not evidence of deployed environment values.

## 5. Backup, restore and failure recovery — BLOCKED

No approved backup, provider connection or restore source was available. No production backup was created or downloaded. No backup restoration was performed. Restore duration, retention window, RPO/RTO and production data counts/totals are **not measured**. Synthetic historical-fixture migration tests do not substitute for restoration of an approved production backup.

Verified local failure recovery: the PostgreSQL migration test deliberately conflicts with a new ledger table, verifies transactional rollback retains 0001 and does not leave newly created ledger tables, and disposes only its own test schema. Populated unversioned fixture tests preserve password hashes, IDs, historical expenses/amounts and original category limits across repeated upgrades. Neither test proves actual backup completeness.

When access is authorized, obtain a secured provider snapshot or custom-format logical backup using the confirmed direct endpoint and secure credential injection. Restore to a separately identified disposable target; never use production as the restore target. Do not use clean/drop flags. Record backup identity/time, source and target identities, PostgreSQL/tool versions, baseline schema/history, table counts, ownership/orphans/sequences and exact expense/purchase/summary totals without exposing personal records. Time restore and migrations. Compare all baselines after upgrade, run isolated integration/reconciliation tests, simulate upgrade failure, and demonstrate recoverability. Use the actual plan's documented retention, not an assumed window.

## 6. Pre-deployment checklist

- [x] Preserve existing work on a dedicated local candidate branch.
- [x] Record source hashes, lockfile/runtime versions and scoped credential/path review.
- [x] Rerun full local backend matrix and available frontend/browser/PWA suites.
- [ ] Obtain immutable reviewed candidate commit and clean-machine/CI reproduction; do not push an auto-deploy branch prematurely.
- [ ] Verify authorized Neon identity, schema/search_path and actual migration history/compatibility.
- [ ] Verify backup and isolated restore, historical financial reconciliation, role/TLS/pooling and measured migration lock timing.
- [ ] Assess all backend dependency advisories and resolve/approve release-blocking findings.
- [ ] Review external money-contract compatibility, legacy allocation provenance and confirmed-purchase correction/support policy.
- [ ] Confirm deployment ordering/write pause, approved recovery artifact and monitoring ownership.
- [ ] Obtain explicit deployment authorization after all blockers are closed.

## 7. Safe deployment sequence — instructions only

1. Keep release on hold until provider inspection, restore/security/reproduction gates close. Review exact candidate changes and evidence; do not silently change migration bodies already applied elsewhere.
2. Rehearse exact candidate migrations/backend/frontend on the isolated restored copy with production-equivalent sessions/role. Measure lock waits and resource requirements; establish statement/lock timeouts and a maintenance/write-pause plan.
3. Retain tested backup and previous artifacts. Verify Render/Vercel automatic deployment will not publish the UI before its API/schema exists. Obtain authorization separately.
4. Pause competing writers and apply the reviewed chain through the authorized migration mechanism. Check expected history before and after. Stop on mismatch/failure; never stamp around it.
5. Release backend first; verify schema-aware startup/readiness, authentication/authorization, CORS, source/derived reconciliation and exact money contracts. Release frontend only afterward with the approved Render API URL and coordinated version/cache metadata.
6. Resume writes only after smoke checks and observation. No step in this sequence was executed against production here.

## 8. Post-deployment smoke tests — future authorized release

Verify exact deployed SHA/version; root homepage for authenticated/anonymous visitors; login/registration/protected/admin routes; existing-account financial history; explicit zero/unconfigured budget; month-scoped allocations; partial purchase/persistence/retry and expense reconciliation; monthly/shopping deep links/history; currency preferences; CORS; PWA update/install/offline behavior. Any write-producing production smoke test needs a specifically authorized disposable account and cleanup plan; otherwise run it on staging. Never insert demonstration records into real accounts.

## 9. Monitoring and recovery

Monitor API errors, database pool exhaustion/stale connections, lock waits/timeouts, purchase/manual replay/conflict rates, expense-to-purchase mismatches and monthly/source-summary reconciliation. Avoid logging credentials, tokens or financial payloads. Define alert ownership and stop-write thresholds before release; none were configured by this phase.

On failed migration, verify transaction rollback and preserved revision/data before restarting services. On post-migration failure, pause writes and use a rehearsed compatible artifact or reviewed forward repair. Do not assume the old backend can write safely with monthly allocations; do not restore over legitimate new purchases without an explicit recovery/reconciliation decision. Destructive downgrade is not a rollback strategy.

## 10. Final decision

**NO-GO.** Local tests establish the documented fixture outcomes. They do not establish actual Neon compatibility, production-backup restoration or provider/deployment parity. Backend dependency advisories also require triage and remediation with regression retesting. Those gates remain open. The local uncommitted candidate and evidence are ready for review; no merge, push or deployment has occurred.
# Phase 9 follow-up

This is retained Phase 8 evidence. See `PHASE9-RELEASE-GATES.md` for the upgraded
backend stack, clean runtime/tooling advisory scans and expanded regression suite.
Its new source manifest supersedes this document's candidate hashes for current
source. Actual Neon compatibility and approved backup/restore evidence remain
pending; production is still **NO-GO**. No commit, push, merge or deployment was
performed.

