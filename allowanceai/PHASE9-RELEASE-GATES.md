# AllowanceAI — Phase 9 security and infrastructure release gates

30 October 2026, Africa/Johannesburg. **Production decision: NO-GO.**

All advisory findings reported against the tested local Python runtime/test and separate tooling environments are resolved by compatible package upgrades; fresh scans report no known vulnerabilities. Application and procedure regression tests pass. Actual Neon identity/schema/history, an approved production-backup restore rehearsal, and production image/configuration parity remain unverified. No production connection, data change, migration, credential rotation, service change, commit, push, merge or deployment was performed.

## 1. Candidate scope and integrity

Continued on `codex/phase8-release-candidate-20261030`, based on `ca094173e2d8fd99cf03ae7e353d491b92ccef4a`. Existing implementation/remediation remains uncommitted. No immutable release SHA is claimed. Earlier reports and the Phase 8 source manifest/archive are historical evidence, not hashes of the changed Phase 9 candidate.

The full Git working tree and the Phase 8 text-file hashes were reviewed. Before adding the Phase 9 evidence, only `backend/requirements.txt` and `backend/inspect_schema_readonly.py` among that source list changed in this phase. Other new Phase 9 files are inventoried below. Existing financial source/migrations/public UI were preserved. Four generated workspace/item screenshots are retained separately and excluded from source packaging; two workspace screenshots were already modified when this phase began. No indiscriminate staging or restoration of those files was done.

`PHASE9-SOURCE-MANIFEST.json` records current source SHA-256 values and a complete changed-file inventory, including classification of generated screenshot evidence. It excludes itself and this final report from circular source hashes. Nothing is staged. Private .env, local database, virtualenv, node_modules and dist paths are ignored. A high-confidence candidate secret/path scan is recorded at the end of this report; it is not a comprehensive secret-detection certification.

### Files changed by this phase

- Updated `backend/requirements.txt`: coordinated FastAPI/Starlette/Pydantic and python-dotenv security upgrade.
- Added `backend/requirements-bootstrap.txt`, `requirements-tooling.txt`: patched installer/build tools; scanner kept separate from application runtime.
- Added `backend/PHASE9-PYTHON-DEPENDENCIES.txt`, `PHASE9-TOOLING-DEPENDENCIES.txt`: exact installed package snapshots from the clean environments.
- Strengthened `backend/inspect_schema_readonly.py`: explicit identity, direct endpoint and certificate-verified TLS prerequisites; server identity before history; read-only defaults/transaction and bounded timeouts; sanitized failure.
- Added `backend/readiness_snapshot.py` and `tests/test_readonly_inspection.py`: SELECT-only per-table counts/digests/exact monetary aggregates, precision-safe canonicalization, identity/refusal/read-only and historical migration-preservation tests.
- Added `DATABASE-VERIFICATION-RUNBOOK.md`: missing access, private backup, source/destination confirmation, empty isolated target, migration/comparison and recovery instructions.
- Added `PHASE9-BACKEND-AUDIT.json`, `PHASE9-TOOLING-AUDIT.json`, this report and current source manifest. These JSON files contain package/advisory metadata, not connection strings or financial records.
- Added Phase 9 navigation notes to README, ITEM-LEDGER-DEPLOYMENT and the historical RELEASE-CANDIDATE-VERIFICATION report; earlier evidence is retained.

No product features, financial calculations, schema revision bodies, authentication logic, production secrets or deployment configuration were changed by Phase 9.

## 2. Dependency remediation and compatibility

Official PyPI metadata was consulted for available versions, Python requirements and dependency relationships. The old FastAPI requirement excluded patched Starlette, so a forced Starlette override was rejected. The new coordinated pins satisfy package metadata and passed real API/browser regressions without application logic changes.

| Package | Before | After | Purpose |
|---|---|---|---|
| FastAPI | 0.111.0 | 0.162.0 | Allows the patched Starlette/Pydantic stack; latest published version at verification |
| Starlette | 0.37.2 | 1.10.0 | Explicit patched runtime pin; latest published version at verification |
| Pydantic | 2.7.4 | 2.14.2 | Meets new FastAPI's >=2.9 requirement; exact-money serialization/validation retested |
| python-dotenv | 1.0.1 | 1.2.4 | Fixes file-rewrite symlink issue; latest published version at verification |
| pip | 22.3 in old test runtime | 26.2.2 | Patched installation tooling; not a web-request dependency |
| setuptools | 65.5.0 | 84.2.1 | Patched build/installation tooling |
| pip-audit | external temporary scanner | 2.10.1 in separate clean tooling environment | Audits runtime and tooling without adding scanner to production requirements |

Uvicorn 0.30.1, SQLAlchemy 2.0.30, psycopg2-binary 2.9.9, Alembic 1.13.1 and HTTPX 0.28.1 were retained; no known advisory was returned for their installed versions by this scan. Transitive versions are captured in the environment snapshots. This is a dated advisory result, not a promise that an old dependency remains safe indefinitely.

### Clean installation evidence and reproduction

Two new UUID-named virtual environments were created outside the repository using bundled **CPython 3.12.14**. The application/test environment installed patched pip/setuptools followed by `requirements-test.txt`; the independent tooling environment installed `requirements-tooling.txt`. Both installations and `pip check` passed. No old environment was reused or deleted, and no production environment was modified.

From backend, with an authorized normal trust store and a new environment, reproduce:

```text
python -m venv <new-private-runtime>
<new-private-runtime-python> -m pip install --upgrade -r requirements-bootstrap.txt
<new-private-runtime-python> -m pip install -r requirements-test.txt
<new-private-runtime-python> -m pip check

python -m venv <new-private-tooling>
<new-private-tooling-python> -m pip install --upgrade -r requirements-tooling.txt
<new-private-tooling-python> -m pip check
<new-private-tooling-python> -m pip_audit --path <runtime-site-packages> --format json
<new-private-tooling-python> -m pip_audit --format json
```

The two package snapshots capture this Windows resolution, not a universal Linux lock. Include `requirements-test.txt` to restore HTTPX for tests. pip's default freeze excludes pip itself; its exact version is pinned in bootstrap requirements and included in advisory inventory. For an eventual production build, bootstrap only the installer/build pins, then install application requirements; do not install audit tools into the serving environment unnecessarily. No Render build command was changed here.

The actual repository runtime files still specify Python 3.11.9. The new stack metadata supports Python >=3.11, but Windows CPython 3.12.14 verification does not prove the deployed Linux image/3.11.9 security state or optional platform dependencies. Review the production Python/OS patch level and reproduce this candidate under that approved image before release. This remains a provider/build parity gate, not a reason to silently change production settings.

## 3. Exact prior advisory conditions and fixes

The Phase 8 scanner returned 39 records with duplicate advisory IDs, deduplicated in `RELEASE-CANDIDATE-BACKEND-AUDIT.json` to 20 package/advisory-ID pairs. The following conditions and minimum patched versions are the advisory records' reported requirements; application exploitability was not demonstrated. All affected installed versions listed here have been replaced in the new environments. Alias identifiers and evidence remain in the historical JSON.

| Package / advisory ID | Exploit condition | Reported minimum patch |
|---|---|---|
| Starlette PYSEC-2026-1943 / CVE-2024-47874 | Endpoint parses unbounded multipart text fields; memory/CPU DoS | 0.40.0 |
| Starlette PYSEC-2026-1941 / CVE-2025-54121 | Large multipart file rolls to disk on the event thread; service blocking | 0.47.2 |
| Starlette PYSEC-2026-161 / CVE-2026-48710 | Malformed Host changes reconstructed URL; URL-based authorization can disagree with routing | 1.0.1 |
| Starlette PYSEC-2026-2280 / CVE-2026-48817 | HTTPEndpoint subclass accepts unrestricted methods and exposes callable helper attributes | 1.1.0 |
| Starlette PYSEC-2026-2281 / CVE-2026-48818 | Windows StaticFiles resolves attacker UNC path, triggering SMB/credential exposure | 1.1.0 |
| Starlette PYSEC-2026-248 / CVE-2026-54282 | Server forwards a path without leading slash; reconstructed URL authority can be poisoned | 1.3.0 |
| Starlette PYSEC-2026-249 / CVE-2026-54283 | request.form parses urlencoded fields without configured size/count bounds | 1.3.1 |
| python-dotenv PYSEC-2026-2270 / CVE-2026-28684 | Local attacker controls a symlinked .env; set_key/unset_key cross-device rewrite can overwrite its target | 1.2.2 |
| pip PYSEC-2023-228 / CVE-2023-5752 | Installing attacker-controlled Mercurial revision injects clone options | 23.3 |
| pip PYSEC-2026-1795 / CVE-2025-8869 | Malicious tar symlink with older Python extraction fallback; Python patch level matters too | 25.3 |
| pip PYSEC-2026-1796 / CVE-2026-1703 | Crafted wheel extracts outside intended install prefix | 26.0 |
| pip PYSEC-2026-196 / CVE-2026-8643 | Malicious console/gui entry-point name treated as a path | 26.1.2 |
| pip PYSEC-2026-2875 / CVE-2026-3219 | Concatenated tar/ZIP archive interpreted as the wrong archive type | 26.1 |
| pip PYSEC-2026-2876 / CVE-2026-6357 | Newly installed modules imported by subsequent installer self-update logic | 26.1 |
| pip PYSEC-2026-3721 / CVE-2026-13346 | Malicious package index supplies doubly encoded URLs; download/install path escape | 26.2 |
| setuptools PYSEC-2022-43012 / CVE-2022-40897 | Malicious legacy package-index HTML triggers regex DoS | 65.5.1 |
| setuptools PYSEC-2025-49 / CVE-2025-47273 | Legacy package-index download URL yields an unsafe destination path | 78.1.1 |
| setuptools PYSEC-2026-1918 / CVE-2024-6345 | User-controlled legacy package-index download inputs permit command injection | 70.0.0 |
| setuptools PYSEC-2026-3447 / CVE-2026-59890 | macOS Unicode normalization bypasses source-distribution exclusion rules | 83.0.0 |
| setuptools GHSA-xmj3-9gf7-h52w | Windows legacy wheel namespace metadata writes __init__.py outside destination | 84.1.0 |

The application uses JSON requests and its own bearer/role/ownership checks; it does not register HTTPEndpoint subclasses, backend StaticFiles or dotenv set_key/unset_key calls in the reviewed paths. Those preconditions were not used as waivers: the vulnerable packages were upgraded. Installer findings concern malicious build/download inputs, not ordinary API calls. Do not conflate runtime and build-tool exposure.

Primary advisory corroboration: [multipart fields](https://github.com/Kludex/starlette/security/advisories/GHSA-f96h-pmfr-66vw), [large files](https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73), [urlencoded limits](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq), [URL authority](https://github.com/Kludex/starlette/security/advisories/GHSA-jp82-jpqv-5vv3), [dotenv file rewrite](https://github.com/advisories/GHSA-mf9w-mj56-hr94). Full ID aliases/fix versions are retained in the Phase 8 evidence; current official package requirements were checked through PyPI. No live exploit attempt was made.

### Fresh audit outcomes

- Runtime/test environment, including its pip/setuptools and HTTPX: **exit 0, no known vulnerabilities**; `PHASE9-BACKEND-AUDIT.json`.
- Separate clean tooling environment, including pip-audit's own dependencies: **exit 0, no known vulnerabilities**; `PHASE9-TOOLING-AUDIT.json`.
- Frontend `npm audit --json`: **exit 0, zero findings**; Vite 6.4.5 and esbuild 0.25.12 retained.
- No unresolved advisory was returned for these audited installed inventories. This does not establish production package/OS/Python inventory, independent penetration-test coverage or future advisory status.

TLS validation remained enabled. Windows trusted CA certificates were used for Python package/advisory requests; Node used its system trust store. No trusted-host flag, certificate-verification bypass, force upgrade or credential logging was used.

The runtime scan covers 31 installed distributions and the tooling scan covers 30. These are separate environments; the counts must not be summed as distinct application packages.

## 4. Complete regression evidence

All writes were confined to guarded new loopback PostgreSQL schemas and disposable SQLite/API fixtures. No real account or financial records were used or changed.

| Verification | Final result |
|---|---|
| PostgreSQL full suite, autoflush=False, autocommit=False/expire_on_commit=True | **45/45 PASS**, 46.745 seconds |
| PostgreSQL full suite, autoflush=True | **45/45 PASS**, 65.986 seconds |
| SQLite full suite | **45 run, 39 pass, six PostgreSQL-only skips**, 13.680 seconds |
| Real item browser E2E on upgraded backend | PASS: item/category/save/reopen/apply, changed-price partial purchase, linked expenses/analytics, five widths, 100/65/35 |
| Real remediation browser E2E | PASS: workspace transitions/history/deep-link refresh, purchase/manual lost-response reload and same-key retry |
| Existing workspace E2E | PASS: registration/login/logout, zero state, month editing, CRUD, refresh/currency persistence, user isolation, charts/retained routes/admin denial |
| Browser smoke | PASS; older API responses mocked |
| PWA install lifecycle | PASS; native eligibility/installation events mocked, not physical device certification |
| Built PWA smoke | PASS: service worker, offline homepage, manifest and direct Help route |
| Currency unit tests | 2/2 PASS |
| Frontend production build | PASS, 692 modules |
| Backend compileall / package consistency / diff whitespace | PASS |

An isolated old/new framework OpenAPI comparison found identical route/parameter/declared-response-status/request-required surfaces for **54 operations**. This is a structural comparison, not a full equivalence proof. A separate no-database TestClient probe verified one framework-level wire change: missing bearer credentials now return **401 with WWW-Authenticate: Bearer**, versus old **403 without a challenge**, with the same `Not authenticated` detail. The bundled client handles 401 and its authentication/protected/admin/browser regressions pass. External clients that explicitly expect the old 403 must be reviewed; this difference is disclosed rather than hidden by the structural comparison. No auth dependency or ownership check was removed or bypassed.

The original 40-test suite also passed both PostgreSQL modes and SQLite immediately after dependency upgrade. Five inspection-safety cases were then added. One new PostgreSQL fixture initially omitted a category and received the expected 404; it was corrected to create the category explicitly. The complete final matrix above passed afterward. No failed run is relabeled as a pass. Existing datetime.utcnow, legacy startup/Pydantic and Starlette's HTTPX TestClient deprecation warnings remain; they are not test failures or silently suppressed security findings. HTTPX remains supported by this tested TestClient compatibility path, though the upstream warning recommends a future HTTPX2 migration; no unrelated test-client migration was introduced here.

Coverage includes authentication/authorization and old account password compatibility; atomic create/update/delete rollback; mixed concurrent operations and repeatable analytics; partial/multiple-date/changed-price purchases and same-key replay; exact Decimal boundaries and historical sub-cent reconciliation; monthly/user isolation; explicit flush with production-style sessions; clean/populated/unknown-head/drift migration cases and transactional DDL failure recovery. The new tests prove identity mismatch stops before history inspection, remote TLS/provider/direct-endpoint prerequisites, actual PostgreSQL rejection of an attempted write in a read-only transaction, repeatable aggregate/digest evidence, and unchanged baseline-table digests across migration. No actual production restore is inferred from those fixtures.

Reproduction commands: backend `python -X utf8 tests/run_local_postgres.py` with WORKSPACE_TEST_AUTOFLUSH separately 0 and 1; `python -X utf8 -m unittest discover -s tests -p "test_*.py"` without WORKSPACE_TEST_POSTGRES_URL for SQLite; `python -m compileall -q .`. Frontend commands and six browser scripts are unchanged from the Phase 8 report. Real browser tests must target only `tests/serve_workspace_test.py` and the local frontend, never production.

## 5. Neon access gate — STOPPED before connection

No Neon connector is exposed, no authenticated Neon CLI is available, no NEON_API_KEY or production DATABASE_URL is injected, and the known local backend configuration points to loopback PostgreSQL. No new Neon project, branch, role, grant or environment file was created. No attempt was made to use HexSOC configuration.

Specific missing access: an authenticated provider session scoped to the existing organization/project/production branch, or an owner-authorized secure backend context supplying the intended direct connection with an existing inspection role. Independently confirm exact endpoint, database, schema/search_path and role from provider metadata before connection. SELECT access to tables/sequences/catalogs is sufficient; migration or write permission is unnecessary. Do not send plaintext credentials in chat or reports.

`DATABASE-VERIFICATION-RUNBOOK.md` contains the commands and nonsecret identity assertions. The strengthened helper refuses missing/mismatched identity before connecting; defaults the connection to read-only; verifies actual database/schema/role/search path before schema/history queries; and bounds waits. Its provider confirmation is explicitly an operator assertion requiring independent provider evidence, not proof synthesized from a hostname. It never loads .env, prints a URL, runs startup/migrations or repairs/stamps records. Actual production schema/history/constraints/index/sequence inspection remains **NOT EXECUTED**.

## 6. Backup/restore gate — PREPARED, not executed

The runbook now specifies private source baseline/dump coordination, approved direct endpoint and secure service/password files; separate human confirmation of both identities; a new empty loopback UUID-named destination; server-reported identity/empty-catalog checks; single-transaction non-destructive restore; before/after table counts, exact sums and digests; user/FK/sequence/ledger validation; exact candidate migrations; a separate disposable failure target; measured restore/recovery duration and source-of-truth reconciliation.

`readiness_snapshot.py` issues SELECTs only and refuses execution outside a PostgreSQL read-only transaction. It casts legacy floating columns using the same PostgreSQL NUMERIC conversion as migration before hashing, preserves long Decimal strings without context rounding, and outputs counts/digests/aggregate totals instead of raw personal records. New month allocations are reviewed separately as inferred `legacy_snapshot` rows. Keep evidence private outside Git.

No approved backup source was available. No production dump, isolated production-data restore, restore timing, lock timing, RPO/RTO or provider retention entitlement was verified. Existing local synthetic migration/failure tests do not close this gate. Restore must never target production or clear an existing database. No destructive downgrade is provided; use a rehearsed compatible artifact/forward repair or explicitly approved separate restore with reconciliation of any later financial writes.

## 7. Remaining blockers and safe next steps

1. Obtain authorized provider mapping/secure read-only access and complete the actual Neon compatibility/history inspection. Stop on incompatible or unknown schema; do not stamp around it.
2. Obtain an approved source backup and separately confirmed empty target; execute the isolated restore/migration/failure-recovery rehearsal and record exact financial/historical preservation and timings.
3. Verify the actual production Linux/Python/toolchain/installed package inventory, deployment-role privileges/TLS/pool behavior and Render/Vercel ordering against this reviewed candidate. Bootstrap patched installation tools in the eventual approved build; local environments do not patch existing production resources.
4. Review existing exact-money-string and missing-bearer 401 external-client compatibility, legacy monthly snapshot uncertainty and immutable purchase correction/support policy. No reversal feature or financial-record rewrite was added.
5. Review the complete candidate/source hashes, obtain explicit commit/release authorization, then follow migration-first/backend-first/frontend-last sequencing from the release runbook. **No commit/push/merge/deploy is authorized by this phase.**

No known local dependency advisory remains in the scanned inventories. Application/load/time-zone/physical-device/OS security are not comprehensively certified. Final recommendation stays **NO-GO** until production-specific compatibility and recovery evidence is complete and the eventual release is separately authorized.

## 8. Final source/credential review

The final Git candidate path check found zero private environment/database/dump/virtualenv/cache/build/PEM paths. High-confidence text scanning for credential-bearing PostgreSQL URLs, private keys, GitHub tokens and AWS access-key patterns found zero matches. `git check-ignore` confirms the local .env, SQLite database, .venv, node_modules and dist are ignored. Diff whitespace passed. Staging is empty. Production Procfile/runtime/version-selector/Vercel/Render configuration paths have no Phase 9 diff. Existing changed source and generated screenshots remain local and reviewable; the manifest classifies screenshot evidence as excluded from source packaging.

Final manifest: **139 verified file hashes**, including four preserved generated screenshots flagged outside the source package, and **82 uncommitted paths** in the complete change inventory. Manifest SHA-256: `5a36b118db134b42c9b8abdf7a3b6831ddcdcc284ca211fc28c78ceeb57a69c6`. A source/evidence archive containing the 135 package entries plus the manifest was created outside Git at `C:\Users\WINDOW~1\AppData\Local\Temp\allowanceai-phase9-source-f8ae3a80ef5045ce863a44252db89019.zip`; SHA-256 `6355cac58380867ccb7308047fcf9959719ed6602a1df0605464667c30d1131d`. The final report itself is separate to avoid circular hashes. Temp storage is not durable backup; retain source evidence securely outside Git before cleanup if needed. The disposable API/dev/preview servers were stopped. No source mismatch, staged file or production configuration change was present at the final check.
