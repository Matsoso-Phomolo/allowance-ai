# Budgeting identity release — 29 October 2026

## Scope

AllowanceAI is presented as Your Personal Budgeting and Money Management System. Homepage copy emphasizes allowance planning, spending, expenses, categories, savings targets, monthly reports and rule-based insights. No completed income ledger, bank integration or external generative AI is claimed. Matsoso Phomolo remains the independent owner/developer with a portfolio link.

Shared CSS tokens introduce #EAF5E8 / #D4EBCB green backgrounds, #277A43 actions, #173D2C text and #8DBD75 accents. Forms and tables keep readable white surfaces. Public navigation, homepage, authenticated shell, charts, authentication, offline fallback and manifest theme use the identity. No banknote photographs, portraits, insignia or security artwork are included.

Budget summary adds the existing backend total_planned metric and clearer monthly budget, actual expenditure, remaining budget and savings goal terminology. Text labels distinguish within budget, approaching limit, at risk and actual overspending without relying on color alone. Dashboard financial logic, user data, endpoints, account controls and role authorization are preserved.

Shared src/currency.js formats structured amounts in summaries, category/expense lists, reports/PDF display, planner, purchase evaluator, saved shopping lists, timetable and admin summary. ZAR remains the existing default. Optional LSL displays M with two decimal places; selection is stored in this browser only. It is a denomination/display choice, not conversion. Backend-generated narrative currency wording and raw numeric CSV/account exports remain unchanged. No database currency field was added; no existing stored preference exists in the current models.

## Verification

- Frontend production build: PASS with Vite 5.4.21; existing CJS deprecation notice.
- Currency unit test: PASS (ZAR default, LSL decimal/negative/zero formatting, preference handling, no numeric conversion).
- Browser regression suite: PASS. Homepage/public routes, authentication guards, safe return destination, authenticated homepage, mobile navigation/deep refresh, logout, currency selection/persistence and ZAR restoration, textual status labels, public and authenticated widths 320/375/768/1024/1440, no runtime errors.
- Initial currency selector test exposed an accessible-name mismatch; explicit select name added and full suite rerun successfully.
- Desktop/mobile homepage screenshots refreshed and visually inspected. Exact page background verified as rgb(234,245,232).
- Non-breaking npm audit fixes applied within current dependency ranges: 25 transitive packages updated, no force/major upgrade. Findings reduced from 8 to 2. Current release-audit.json records one moderate esbuild finding and propagated high Vite finding; development-server exposure is the reported vector. Vercel production serves static dist and does not expose the Vite development server. Major Vite upgrade remains separate work; no audit pass is claimed.
- Final PWA production-build suite: PASS (worker, manifest, offline cached homepage, direct help route). Backend compileall: PASS.

## Git and production

Existing local main already contains non-rewriting merge bdcf8c8 of implementation 7e4bcc8 and remote main b99873a. Fetch confirmed no additional upstream commits at the start of this request. All main history is preserved. This request explicitly authorizes committing and pushing the budgeting identity after verification. No force-push, database reset/migration or credential change is required.

Current Render /ready still times out from this environment (20-second probe, HTTP 000). This pre-existing connectivity problem is separate from the verified static frontend change. The public release can be checked independently; live login, registration, database readiness and financial persistence remain unverified unless a subsequent live probe succeeds. No existing account or financial data was mutated to test production.

Vercel Git integration previously reported successful main→Production deployment through GitHub commit statuses. The CLI token is invalid; exact release commit status and canonical URL are checked through the authenticated GitHub CLI and live browser after push. Provider environment values and Render auto-deploy settings are not accessible here. Final response records push SHA and observed deployment status rather than assuming success.

Formal approved privacy/terms policies remain an existing limitation; factual information pages disclose that status. Real-device PWA installation and full WCAG certification are not claimed.
