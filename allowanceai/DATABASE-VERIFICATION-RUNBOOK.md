# Identity-first inspection and isolated recovery rehearsal

Prepared in Phase 9; **not executed against Neon or a production backup**. No command here authorizes deployment, production DDL, restore over an existing database or a credential change. Stop if any identity, permission or comparison is uncertain. Credentials and backup/snapshot files stay outside Git and chat.

## Access that is missing

An authenticated Neon CLI/MCP connection or an owner-approved secure backend execution environment must independently confirm organization `org-red-tree-39733852`, project `royal-hill-71285700`, branch `br-patient-voice-b4tgg6yw` (`production`), database `neondb`, direct compute endpoint/port and intended schema. The endpoint and actual schema are not known from the current workspace. Do not infer them from a URL supplied without provider confirmation.

Use an existing least-privilege inspection role if available: CONNECT to the intended database, USAGE on the schema, SELECT on application tables and required sequences, and catalog visibility. No CREATE, INSERT, UPDATE, DELETE, TRUNCATE or migration permission is needed for inspection. Do not create a role or change grants as part of this read-only stage. If using the existing owner role through an authorized environment, the client still enforces read-only transactions, but that is not equivalent to independently restricted credentials.

Securely inject DATABASE_URL; do not pass a credential-bearing URL on the command line, print environment values, enable shell tracing, export secrets to the frontend, run env pull into tracked files or paste credentials into chat. Obtain approved endpoint-to-project/branch mapping through provider metadata. No Neon connection or profile is currently available here.

## A. Read-only identity and compatibility inspection

The following variables are nonsecret assertions entered from independently reviewed provider metadata; DATABASE_URL is supplied separately by the secure execution environment:

```powershell
# Run in allowanceai/backend using the reviewed clean Python environment.
# Set these to the independently confirmed host/database/schema/inspection role.
# Do not derive expected identity by parsing DATABASE_URL.
$env:ALLOWANCEAI_INSPECT_HOST = '<approved-direct-endpoint>'
$env:ALLOWANCEAI_INSPECT_DATABASE = 'neondb'
$env:ALLOWANCEAI_INSPECT_SCHEMA = '<approved-schema>'
$env:ALLOWANCEAI_INSPECT_ROLE = '<approved-inspection-role>'
$env:ALLOWANCEAI_INSPECT_NEON_CONFIRMED = 'royal-hill-71285700/br-patient-voice-b4tgg6yw'
# Explicit operator confirmation, after independently reviewing all five fields:
$env:ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED = '<approved-host>|5432|neondb|<approved-schema>|<approved-role>'
python -X utf8 inspect_schema_readonly.py
if ($LASTEXITCODE -ne 0) { throw 'Inspection failed; stop and review securely.' }
```

The helper does not load .env. It refuses missing/mismatched identity, pooled endpoints and remote connections without certificate-verified TLS (`sslmode=verify-full` preferred, or approved `verify-ca`); preserve the provider trust chain rather than disable verification. Connections default to read-only at startup. Inside one REPEATABLE READ transaction it sets READ ONLY, 15-second statement and 3-second lock timeouts, then compares actual current_database/current_schema/current_user/current_schemas to expected values **before reading migration history or application data**. A schema's search path must resolve only to the intended application schema; `pg_catalog` remains implicit. Do not run an unreviewed search-path override to work around a mismatch.

Next it enumerates the selected schema and invokes the existing fail-closed type/nullability/constraint/index/sequence/ownership/history validators. Unknown/multiple Alembic heads, partial legacy schema or schema drift stop inspection. `deployment_ready` remains false even on success. The confirmation variable is an operator assertion; it is not cryptographic provider proof. Retain the independent provider mapping in the private release evidence.

No `alembic current` is required during this stage; the repository migration environment is a separate executable path and must not be confused with this inspection-only helper. Never run `upgrade`, `stamp`, startup DDL or application write-producing tests against production for inspection.

## B. Private source baseline and approved backup

1. Obtain explicit backup approval, the actual Neon plan's retention/restore entitlement and an encrypted/access-controlled evidence location outside the repository. Record source project/branch/endpoint/database/schema/role, backup timestamp and tool/server versions. Define how concurrent source writes are paused or otherwise snapshot-coordinated. Do not claim separate baseline and dump transactions observe the same instant while writes continue.
2. With the same confirmed read-only source configuration, create a private evidence file: `python -X utf8 inspect_schema_readonly.py --snapshot > <protected-source-baseline.json>`. Check exit status and restrict file ACLs. Output includes aggregate financial totals and per-table digests, so treat it as private evidence even though raw rows/password hashes/credentials are not output.
3. Obtain an approved custom-format dump using a direct endpoint and a securely provisioned PGSERVICE/PGSERVICEFILE plus PGPASSFILE outside Git. Set source PGOPTIONS to `-c default_transaction_read_only=on`; use TLS with verified trust and noninteractive failure. Example executable arguments contain no credentials:

   ```text
   pg_dump --no-password --format=custom --file=<protected-source.dump>
   pg_restore --list <protected-source.dump>
   ```

   PGSERVICE must already select the independently confirmed source. Stop if the dump tool major version is older than the source server. Inspect archive contents privately. Record SHA-256, start/end timestamps and successful exit codes. A hash or successful dump alone does not prove restorability. Do not use dump commands before backup approval.

## C. Explicit source/destination confirmation and empty-target guard

Only a dedicated, newly provisioned **loopback PostgreSQL database** is supported by this rehearsal recipe. A remote rehearsal needs a separately reviewed identity guard. Do not auto-create or drop databases in this procedure. An authorized operator prepares the empty target with a unique database name `allowanceai_rehearsal_<32 hex UUID>`, an isolated role/credentials and restricted network exposure. Restored PII/password hashes must never be exposed by a public test API.

Before restore, require a human to confirm both full nonsecret identities in the private evidence:

```text
SOURCE: <confirmed organization/project/production-branch/direct-host/port/database/schema>
DESTINATION: <confirmed loopback server address/port/allowanceai_rehearsal_UUID/schema/role>
I confirm that DESTINATION is a newly created empty disposable database, is not production,
and differs from SOURCE. Only this destination may receive restore/migration writes.
```

Switch to a separate destination PGSERVICE/PGPASSFILE, and independently inject the corresponding DATABASE_URL for Python tools. Never reuse the source service name or rely on changing only an undocumented default. Verify destination host is literally localhost/127.0.0.1/::1, database matches the UUID pattern and role/schema match the confirmed record. Connect read-only first and query:

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user, current_schema(), current_schemas(false),
       inet_server_addr(), inet_server_port(), version();
SELECT nspname FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema';
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema';
SELECT sequence_schema, sequence_name FROM information_schema.sequences;
ROLLBACK;
```

Stop unless the server-reported address is loopback (including mapped loopback), database/port/role/schema are exact, and the destination has no user tables, sequences or unexplained user schemas. Separately verify no views, foreign tables, routines or extensions other than standard plpgsql exist. Do not clear a nonempty target; request another empty one. Record identity and empty-catalog evidence before changing PGOPTIONS from read-only for the **destination only**. No restore is permitted if the source/destination confirmations are absent.

## D. Isolated restore, comparisons and migration

1. On that confirmed empty destination only, with a destination role and approved dump, execute `pg_restore --dbname="service=allowanceai_rehearsal" --no-password --exit-on-error --single-transaction --no-owner --no-acl <protected-source.dump>`. The independently provisioned `allowanceai_rehearsal` service entry must identify the confirmed empty destination; it contains no source endpoint. An explicit --dbname is necessary: without it pg_restore may emit SQL rather than restore through the destination service. Do not use `--clean`, `--create` or drop flags. Capture protected logs and wall-clock duration. Permissions/owners are intentionally not cloned by this command; document the rehearsal role and compare/review production deployment privileges separately. Never reuse production secrets in the isolated API.
2. Set destination inspection variables to its independently confirmed identity and execute the read-only snapshot helper. Compare source/restore table counts, every pre-existing table digest, exact monetary aggregates, ownership/foreign-key/sequence checks and Alembic revision. Differences are blockers, not auto-repair instructions. Confirm expected schema/search_path before history comparison. Record archive hash, tool version, duration and mismatches without including raw personal records in reports.
3. Take another approved backup of the restored baseline or retain a second separately prepared isolated restore target for failure/recovery rehearsal. Never introduce a deliberate migration conflict into production or the only recovery source.
4. Only on the confirmed destination, run the exact candidate migration chain `python -m alembic upgrade head`. Record duration/lock behavior/revision. If a failure occurs, stop; do not stamp head or delete history.
5. Re-enable the destination read-only inspection configuration, capture another snapshot and compare all **pre-existing** table digests/counts/totals. Newly added ledger tables should be empty if no prior ledger exists. Month allocation rows are expected additions with `legacy_snapshot` provenance; compare them to the unchanged legacy category amounts and known budget/expense months. Do not assert historical monthly limits were reconstructed.
6. Inspect line→expense totals/unique links, partial quantities, allocations by user/month, category/plan/event ownership and actual-spend summaries. Existing fail-closed ledger validation checks core ownership/reconciliation; independently review any additional anomalies. Raw actual spending sums expenses once, not expenses plus purchase lines. Counts/digests verify that old password hashes and records were retained without printing them.
7. Exercise candidate API/browser checks with disposable accounts on a restricted staging copy after the preservation baseline is recorded. The existing automated PostgreSQL runner creates its own new schemas and therefore is **not** an automatic full acceptance test of the restored schema; do not describe its passing result as restored-data verification. Point no generic write-producing suite at production. Review which tests actually use migrated fixtures.

## E. Simulated failure and recovery evidence

On a second dedicated empty restore target only, restore the same backup, record the baseline and deliberately introduce a reviewed conflicting new table in a disposable schema, then run the migration expecting failure. Verify the previous Alembic revision and source digests remain, and no partial ledger DDL/financial writes escaped. Local regression `test_postgresql_failed_upgrade_rolls_back_ddl_and_preserves_baseline` verifies this with synthetic data; actual backup-copy evidence still needs the authorized rehearsal. Do not deploy an intentionally broken migration.

Record restore/migration/recovery start/end times, counts, exact sums/digests and test outcomes. A failed single-transaction restore should leave its previously empty target empty; inspect it before retry and choose a fresh target if uncertain. Never perform cleanup against production.

Destructive downgrades are disabled. After successful migration, recovery uses a reviewed compatible artifact or forward repair, or an explicitly approved restore into a separate recovered database with reconciliation before any cutover. If new financial writes have happened, an old backup can discard them; pause writes and account for every purchase/expense before recovery. Previous application write compatibility with month-scoped allocations must be rehearsed, not assumed. Define RPO/RTO from measured results and actual backup retention. No duration or successful restore is claimed by this document.
