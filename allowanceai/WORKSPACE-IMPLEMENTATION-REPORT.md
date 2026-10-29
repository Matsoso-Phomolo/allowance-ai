# Financial workspace and zero-default implementation — 29 October 2026

## Outcome and preserved scope

New registrations create only a user. No seed budget, category, expense, savings goal, shopping list or welcome/fictional financial notification is generated. Existing account and financial rows are preserved. No production database, credentials, service names, schema/model definitions or authentication hashing/authorization rules were changed.

The authenticated application has a compact persistent desktop sidebar, three navigation groups, contextual feature tabs, a mobile dialog drawer, compact header/account controls, overview metrics, utilization, recorded recent expenses, actual category breakdown and relevant rule-based insights. All sixteen prior modules remain accessible; notifications and administration have dedicated views. Home/Help marketing links are removed from the workspace. Rentalink's local layout informed navigation quality only; AllowanceAI's independent green identity remains.

Public pages retain their design. Only two registration/onboarding descriptions were corrected to remove references to starter amounts. The existing public sample dashboard remains clearly demonstration-labeled and disconnected from authenticated state.

## Audit findings and corrections

| Value | Previous source | Correction |
|---|---|---|
| Allowance 1500 / savings target 100 | Registration called backend/seed.py and created a real budget row | Seeder call and module removed; no budget row until explicit save |
| Planned expenditure 1500 | Seven automatically inserted category limits summed to 1500 | No default categories; zero sum for a new account |
| Planner 1500 / 100 / 250 / 200 | Independent frontend fallback/proposal inputs | Zero/nullish defaults; no plan until explicit valid input/action |
| Budget form 1500 / 100 | Placeholder text only | Neutral zero placeholders; explicit zero values accepted |
| Welcome/risk notifications for empty accounts | Registration message and analysis of absent budgets | Registration stays quiet; absent/zero empty budgets do not generate fictional risk reminders |
| Incorrect month totals | Latest budget across months and all-time expense sums | User/month-scoped selection and spending; full expense history preserved |

GET /api/budget adds configured/month metadata and an optional validated month query. A saved zero budget is distinct from absence. Budget fields load the selected month, including past/future months, without replacing the current overview. Existing duplicate historical budget rows are not deleted; the latest record for the selected user/month is edited. No migration is required. Category limits remain user-owned reusable allocations; the current schema does not store historical monthly category-limit snapshots.

When no budget exists but expenses do, persisted spending remains visible and remaining funds are calculated from zero allowance, explicitly marked unconfigured. Analytics/intelligence require appropriate real activity. A zero planned category with no spending is no longer shown as 100% used; the UI labels unallocated limits rather than presenting an undefined percentage as a useful ratio.

## Changed files

- Backend crud.py: registration, budget selection/save, current-month totals/category usage/behavior/report inputs and empty-account notification guards.
- Backend schemas.py/main.py: nonnegative allowance, validated month input, additive summary metadata, optional month lookup. Existing routes retained.
- Deleted backend/seed.py: removed only source of starter financial inserts.
- Backend requirements-test.txt and tests/test_workspace.py, run_local_postgres.py, serve_workspace_test.py: isolated test dependencies, financial/API regression suite, guarded local PostgreSQL runner and disposable browser API.
- Frontend App.jsx/api.js: separate header, notification wiring, clearing prior account state and rejecting stale session responses; optional month read.
- Frontend Dashboard.jsx: grouped navigation, retained module mapping, empty states and mobile drawer.
- Added WorkspaceOverview.jsx, WorkspaceIcon.jsx, workspaceData.js and workspace.css: real-data overview, consistent icons, configuration/month helpers and scoped authenticated styles. main.jsx imports the separate stylesheet.
- BudgetCards.jsx/BudgetForm.jsx: explicit unconfigured/zero status, monthly editing and load/save/error handling.
- CategoryForm.jsx/ExpenseForm.jsx/CategoryList.jsx: valid fractional inputs, pending/error states and unallocated-limit labels.
- MonthlyPlanner.jsx: zero proposal inputs and explicit generation/error state.
- NotificationCenter.jsx: compact header popup and reusable full-page notifications view.
- PublicSite.jsx: two behavior-accuracy sentences only; public design remains intact.
- Frontend tests/browser-smoke.cjs updated for the grouped navigation and configuration contract; tests/workspace-e2e.cjs added for actual local API workflows.
- Release version/worker/.env.example: 1.3.0; caching strategy unchanged.
- README.md and WORKSPACE-AUDIT.md updated/added. Screenshots: docs/workspace-empty-desktop.png, workspace-overview-desktop.png, workspace-overview-mobile.png. Screenshots contain only explicitly entered disposable local test data.

## Executed verification

- Nine backend regressions PASS on isolated SQLite and on actual local PostgreSQL in temporary schemas. Tested new-account zero totals/no financial rows, explicit zero budget, current/historical months, persisted expense calculations, updates, full history, login persistence, existing-data preservation, missing-budget real spending, rejected invalid writes, user isolation, admin denial and PostgreSQL model DDL compatibility.
- The same nine SQLite and nine PostgreSQL tests PASS in a separate Python 3.11 environment using the exact production-pinned FastAPI 0.111.0, SQLAlchemy 2.0.30, Pydantic 2.7.4 and psycopg2 2.9.9. No production dependencies were upgraded. TestClient/AnyIO emitted resource warnings in the pinned SQLite test harness; no assertions failed. Earlier broader-runtime tests also passed.
- Real frontend → FastAPI → disposable database browser workflow PASS: registration, zero overview, first budget/category/expense, fractional amounts, selected-month budget editing, correct monthly totals, refresh, logout/login, second-user isolation, zero saved budget, empty analytics, zero planner fields, currency persistence/no conversion and mobile drawer. No mocked financial responses are used in this workflow. It also loads all retained module routes with a funded account, including real chart rendering, notifications and role-gated administration.
- Public/authentication/browser regression suite and currency unit test PASS. Responsive checks cover 320/375/768/1024/1440 for both empty and populated workspaces. Screenshots visually reviewed; a text-encoding issue found in screenshots was corrected.
- Frontend production build PASS; backend compileall PASS. Final production-build PWA suite PASS: service-worker registration, manifest launch, cached offline homepage and direct Help route.
- npm audit: two unchanged existing Vite/esbuild development-tool findings, one moderate and one high. No audit pass or major dependency upgrade is claimed.
- Initial PostgreSQL safety check rejected an address containing PostgreSQL inet formatting; normalization retained strict loopback checks and the suite then passed. Exact-version dependency installation initially failed certificate trust; Windows trusted certificates were supplied to pip without disabling TLS, and installation/tests succeeded.

## Production readiness and limitations

- No Neon credentials, Render secrets, database settings or public service names were edited. Models/database/auth/production requirements remain unchanged. No blanket reset or historical financial cleanup was attempted.
- Existing seeded amounts on older accounts remain until the owner edits them; they cannot safely be distinguished automatically from intentional records.
- The code is verified locally with PostgreSQL and exact pinned dependencies. Neon production connectivity was not tested, and no production accounts/financial records were created.
- Production Render /health still timed out during a 20-second read-only check. Backend rollout/logs/auto-deploy cannot be confirmed without provider access. New-account production zero defaults require the updated backend to be deployed successfully; frontend deployment alone does not prove that behavior.
- Existing main→Vercel integration is verified through prior GitHub Production statuses. Exact commit/push/deployment evidence is reported in the final delivery after release checks. No force push is used.
- Current-month calculations follow the backend's existing server date. User time zones and historical category-allocation snapshots are not added.
- Standard-library/API/browser tests do not constitute a full accessibility certification. Currency formatting remains display-only; generated backend narrative wording retains its existing currency labels.

## Readiness checklist

- [x] Registration creates no automatic financial records.
- [x] Unconfigured and explicitly saved zero budgets are distinct.
- [x] Monthly totals and user ownership verified on PostgreSQL.
- [x] Existing rows/model definitions/credentials preserved.
- [x] All prior modules reachable through grouped navigation.
- [x] Empty/populated desktop and mobile layouts tested.
- [x] Refresh/login and currency-display persistence tested.
- [ ] Confirm updated Render backend deployment and live Neon readiness.
- [ ] Verify live authenticated workflows after backend service recovery.
