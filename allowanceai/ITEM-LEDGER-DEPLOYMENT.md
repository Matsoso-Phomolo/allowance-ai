> **Remediation update (30 October 2026):** Read READINESS-REMEDIATION.md before using this runbook. Expected head is now `0003_month_allocations`; money APIs return exact decimal strings and category limits are month-scoped. Production remains NO-GO pending authorized Neon inspection and restore rehearsal. No production commands in this document have been executed by the agent.

# Item ledger release runbook — prepared locally, not deployed

This release requires **backend migration before backend startup**, then backend verification, then frontend publication. Do not push the current working tree to an auto-deploy production branch as a shortcut. No Render/Neon/Vercel settings, secrets or production records were changed during implementation.

## Schema review

- `0001_legacy`: frozen baseline of the nine existing tables. Existing tables are checked for required columns, primary keys and foreign keys; missing constraints stop the upgrade for review. Missing baseline tables are created without seed rows. It does not reassign ownership or repair historical schema silently.
- `0002_item_ledger`: creates `spending_plans`, `planned_items`, `category_preferences`, `purchase_events`, `purchase_lines`. Foreign keys preserve source links; user/key and event/item uniqueness enforce idempotency and line identity. Quantity/amount/state constraints are included.
- Existing monetary storage changes from floating point to **unbounded PostgreSQL NUMERIC**, avoiding a new fixed rounding scale on historical data. Existing IDs, password hashes, ownership, list items, expense dates and values are preserved. New money columns use NUMERIC(18,2), quantities/sizes NUMERIC(16,3). New calculations use Python Decimal with ROUND_HALF_UP to cents **per purchase line**.
- Money calculations and JSON fields use Decimal/exact decimal strings throughout the supported financial paths. Ratios/chart coordinates are presentation data. Legacy numeric-JSON integrations require review; the bundled frontend is updated. Existing sub-cent source values are preserved exactly, not silently rounded away.
- SQLite development retains old table affinity rather than rebuilding live foreign-key tables merely to change type names. SQLite does not prove PostgreSQL precision or row-lock semantics; local PostgreSQL tests cover those.
- Downgrades that would drop financial history are deliberately blocked. A failed PostgreSQL migration rolls back transactionally. Recovery after a successful migration uses a reviewed forward repair, or an approved tested backup restore, rather than dropping ledger tables.

## Authorized release procedure

1. Review the implementation diff and migration snapshots. Confirm the actual dedicated AllowanceAI Neon database and existing schema through authorized provider access. Do not use HexSOC credentials. Identify/resolve any unexpected pre-existing tables, missing foreign keys or unversioned schema differences.
2. Create a restorable backup/snapshot through the actual Neon plan or an authenticated PostgreSQL backup. Verify restore on an isolated branch/database. Retain the previous backend/frontend artifact. No recovery-window duration or backup entitlement is assumed.
3. Test the migrations and this checklist against an isolated copy/schema with representative historical data. Float-to-NUMERIC conversions can hold table locks and rewrite data; schedule a maintenance window and stop writes while applying them. Assess table sizes and lock time on that copy.
4. Install `backend/requirements.txt` in the deployment environment. It adds pinned `alembic==1.13.1`. Preserve `DATABASE_URL`, authentication secret, CORS origins and service identity. Never print the URL or put it in frontend variables.
5. In `allowanceai/backend`, using the securely configured backend environment, run:

   ```text
   python -m alembic current
   python -m alembic upgrade head
   python -m alembic current
   ```

   An existing unversioned database is handled by the reviewed baseline in the upgrade; do not blindly stamp `head`. The expected final revision is `0003_month_allocations`. Stop on a schema mismatch or migration error; do not remove the checks. An empty database uses the same upgrade without fabricating records. Online migrations are the supported path; the baseline inspection is not an offline SQL-generation workflow.
6. Deploy the backend through its existing reviewed Render Git workflow. Keep the existing start command (`uvicorn main:app ...`), service name and secrets. PostgreSQL startup now requires the migration revision and performs no automatic schema upgrade. **Never set `ALLOWANCEAI_TEST_CREATE_SCHEMA` in production**; it exists solely for isolated tests.
7. Verify `/health`, `/ready`, authenticated plan endpoints, normal expense reads and CORS from the Vercel origin. Run the end-to-end checklist below with an explicitly authorized disposable staging account first. Inspect logs without exposing credentials. Do not assume `/health` proves database readiness.
8. Only after backend readiness, authorize and publish the frontend through the existing Vercel workflow. Preserve `VITE_API_BASE_URL=https://allowanceai-backend.onrender.com`. Prepared release version is `1.4.0`; service-worker cache version changes with it. No service-worker caching strategy or public website design is replaced.
9. Verify the exact deployed Git SHA, version.json, browser console, manifest, update prompt, offline fallback and direct routes. Reopen an existing account to confirm history. Monitor failed confirmations and migration/runtime errors.

## API contract

All routes use the existing Bearer authentication dependency. Ownership is checked for every plan, item and category reference. Calculated totals are response-only; extra calculated input fields are rejected. Money and quantity inputs may be decimal strings; new response amounts are decimal strings.

| Endpoint | Behavior |
|---|---|
| POST `/api/items/suggest-category` | Read-only deterministic suggestion from name/description, source/confidence/alternatives; no category or allocation writes |
| GET `/api/items/taxonomy` | Versioned dictionary and parent grouping; no external AI claims |
| GET/POST `/api/plans` | List own plans (optional `kind=monthly`/`shopping`), create zero/explicit-valued plan |
| GET/PUT `/api/plans/{id}` | Reopen/update settings; update requires current version |
| POST `/api/plans/{id}/items` | Add one or many item inputs in one transaction; requires version; no actual spending |
| PUT/DELETE `/api/plans/{id}/items/{item_id}` | Edit or remove unpurchased item; purchased identity/history is protected; skipped/cancelled states can be reopened |
| POST `/api/plans/{id}/reorder` | Full, distinct owned-item ID order plus current version |
| POST `/api/plans/{id}/purchase-preview` | Validate quantities/prices and return server-calculated preview; writes nothing |
| POST `/api/plans/{id}/purchases` | Confirm preview with date, item quantities/prices, version and idempotency key; atomic linked expenses/history/log updates |
| POST `/api/plans/{id}/apply-budget` | Explicit monthly-only budget save and replacement of included category allocations; no expenses |
| POST `/api/shopping-lists/{id}/import-items` | Explicit, once-only conversion of legacy estimates into the item workspace; original records untouched |

Purchase payload example (use real authenticated item IDs):

```json
{
  "version": 2,
  "idempotency_key": "unique-confirmation-key-001",
  "purchase_date": "2026-10-30",
  "items": [{"item_id": 123, "quantity": "2", "actual_unit_price": "32.10"}]
}
```

Send the **same key and same semantic payload** on an uncertain network retry. A replay returns the original event without duplicate expenses, even if the plan version has advanced. Reusing the key for different contents returns 409. Stale editors/competing confirmations return 409 and must reload. Do not generate a new key just because the first response was lost. The UI persists its reviewed request in per-user/per-kind session storage before sending confirmation. Reload restores the same key for reconciliation. After clearing/ending the browser session, inspect purchase history before starting another purchase.

Per-user PostgreSQL row locks serialize ledger and manual financial writes/rebuilds across that user's plans; separate users can write independently. Foreign keys and unique keys provide further integrity protection. Purchase-linked expenses reject direct edit/delete, and are labeled read-only in Expenses. Correcting/reversing a confirmed purchase is not implemented in this release; obtain a reviewed audited adjustment design instead of manually deleting its history.

## Financial interpretation and compatibility

- Three **2.5 kg bags** at 30 each cost **90**, not 225. Package size describes one unit; quantity counts units. Whole packages require whole quantities. Loose measured goods/service durations permit up to three decimal quantity places; loose size must be 1 and price is per measurement unit.
- Saving, editing, evaluating, importing or applying a plan creates **no expenses**. Explicit confirmation of two bags at 32.10 records 64.20 and leaves one bag pending. Purchasing later uses another dated event and its actual price.
- Planned totals and pending estimates are proposals. Category allocations are budget limits. Reserved savings are a separate field, never auto-inserted as a spending item. Actual expenditure is the recorded expense ledger. The main reports sum expenses once; they do not add planning totals or purchase lines again.
- Each monthly or shopping workspace can confirm purchases directly, so users do not need to re-enter monthly items into a shopping list. Analytics compares one selected plan at a time; summing unrelated alternative plans would misrepresent a single budget.
- Price variance compares immutable estimated price snapshots at confirmation with actual totals for purchased quantities. Actual history retains item/category/package snapshots even if category labels are later renamed.
- Category allocations are user/category/month scoped. Migration 0003 copies prior shared limits with legacy_snapshot provenance without rewriting source rows. Applying a monthly plan updates the selected month's budget and **only its included month allocations**; unrelated allocations in that month remain, and other months are unchanged. The UI explains this before the explicit apply action. Review overall budget/category totals afterward.
- Old shopping rows had only total amount, not package/quantity history. Import represents each old row as quantity 1 at its original total; review size/quantity/price before purchase. No automatic match to past manually entered expenses is attempted. Do not confirm old purchases again.
- Unrecognized/ambiguous products remain unresolved until corrected. Suggestions never invoke an unconfigured AI provider. Manual selections remain authoritative; confirmed corrections are reused only for that user. Automatic categories start at zero allocation. Taxonomy parents are system metadata, not a new editable user-category tree.
- Currency preferences remain display-only. No conversion or stored-value rewrite based on display currency occurs. Dates retain existing server-date/month conventions; per-user time-zone accounting is outside this release.

## Verification checklist

- [ ] Confirm backup restore and migration compatibility on an isolated database copy.
- [ ] Upgrade an empty schema and an existing schema; repeat upgrade safely; verify IDs/values/hash/ownership/history unchanged.
- [ ] Register a fresh account: no seeded financial rows and zero summary.
- [ ] Add rice as 2.5 kg bag ×3 at 30; verify 90. Add a fractional loose item and verify cent rounding.
- [ ] Recognize regional items, reuse an existing category, correct a suggestion, reopen and verify the remembered preference. A second user must not inherit it.
- [ ] Save/reopen/reorder/edit monthly items; confirm no expenses. Compare grouped totals, reserved savings and over-allocation warnings.
- [ ] Explicitly apply proposed allocations; verify month budget, included category totals, retained unrelated allocations and zero new expenses.
- [ ] Save/evaluate/edit/import shopping lists without creating expenses.
- [ ] Preview and confirm two of three bags at a changed actual price; check one pending, one expense and matching history.
- [ ] Purchase the last bag on another date; reconcile actual totals, pending quantity, category totals and price variance.
- [ ] Retry the same confirmation/key; verify one event/expense per line. Conflicting key payload, stale version and excess quantity must fail.
- [ ] Run simultaneous same/different-key confirmations on PostgreSQL; verify replay/conflict behavior and no over-purchase.
- [ ] Force a failure after expense insertion; verify rollback of event, lines, expenses, plan version and derived logs.
- [ ] Create 100 items, buy 65, retain 35 pending after refresh/logout/login. Confirm exactly 65 expenses.
- [ ] Skip/cancel/reopen items; forbid purchases of inactive items and preserve purchased audit history.
- [ ] Reject cross-user plan/item/category reads and mutations, including reordered IDs and confirmation references.
- [ ] Confirm old budget/expense/report APIs, account export/delete, administration and public/authentication routes still work.
- [ ] Verify plan-vs-actual analytics and main reports count purchases once; expense history marks linked records read-only and supports showing more records.
- [ ] Verify 320/375/768/1024/1440 layouts, keyboard input/focus, loading/error/retry states, PWA update/offline behavior.
- [ ] After explicit deployment authorization, verify Render readiness, Neon persistence, exact Vercel SHA/version and live account workflows. Local tests alone do not check production.
# Phase 9 prerequisite

Read `PHASE9-RELEASE-GATES.md` and `DATABASE-VERIFICATION-RUNBOOK.md` before this
historical release procedure. The backend dependencies are upgraded; inspection
requires explicit independent identity confirmation and verified TLS. Bootstrap
the patched installer/build requirements in the eventual authorized build.
Production compatibility and actual backup restore remain unverified; **NO-GO**.

