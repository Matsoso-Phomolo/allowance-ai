# Implementation report — 29 October 2026

## Release summary

Public-first AllowanceAI experience with independent Matsoso Phomolo attribution, supported-feature marketing, demonstration-labeled preview using the real summary component, responsive navigation, account menu, FAQ/help/install guidance and factual privacy/terms information. Root is public regardless of authentication. Financial components, backend contracts, models, calculations and user data are preserved.

## Files created

- IMPLEMENTATION-INVENTORY.md: audit before architectural edits.
- frontend/src/components/PublicSite.jsx: homepage, public pages, navigation/footer and account controls.
- frontend/vercel.json: SPA rewrites preserving file/asset paths.
- frontend/tests/browser-smoke.cjs: browser regression checks with isolated intercepted API fixtures.
- frontend/tests/pwa-smoke.cjs: production-build PWA registration/offline/route checks.
- frontend/audit-results.json: dependency audit evidence.
- docs/home-desktop.png and docs/home-mobile.png: visually inspected previews at 1440px and 320px.
- IMPLEMENTATION-REPORT.md: this delivery report.

## Files modified

- frontend/src/App.jsx: public/protected routing, internal return destinations, session-expiry handling, app Home/Help links, retry control and ownership footer.
- frontend/src/main.jsx: BrowserRouter mount.
- frontend/src/api.js: network/validation/service error distinctions and expired-session event; API paths unchanged.
- frontend/src/components/Dashboard.jsx: URL-backed section navigation and responsive shell styling; all original modules retained.
- frontend/src/components/BudgetCards.jsx: ZAR locale formatting and missing-summary state; calculations unchanged.
- frontend/src/components/Login.jsx and Register.jsx: branded forms, home links, pending/disabled submit and accessible errors.
- frontend/src/components/PasswordInput.jsx: password autocomplete and visibility toggle state.
- frontend/src/components/InstallButton.jsx: browser install prompt/guidance replaces HTML launcher downloads.
- frontend/src/styles.css: public design system, desktop app navigation, mobile layout, focus states and reduced motion.
- frontend/index.html: page description/title.
- frontend/vite.config.js: inject release version from public JSON at build time, avoiding direct public-directory module imports.
- frontend/package.json and package-lock.json: React Router 7.18.5. Initial router 6 was replaced after audit flagged it.
- frontend/public/sw.js and version.json: release 1.1.0, scoped cleanup and successful-response caching only.
- frontend/.env.example: release example updated.
- backend/main.py: one explicit production CORS origin added. No other backend change.
- README.md: architecture, ownership, routes, auth, setup, deployment, PWA, troubleshooting and limitations.

## Routes and preserved functionality

Public: /, /features, /how-it-works, /about, /help, /login, /register, /privacy, /terms.

Authenticated: /app and each existing dashboard section under /app. Documented aliases cover dashboard, budgets, transactions, savings, shopping, reports and settings. Notifications stay in the existing header. There were no old URL-based application routes to migrate. Unknown sections offer navigation and fall back to the budget view.

Preserved: budgets/savings targets, category/expense editing, saved shopping lists, rule-based evaluation, timetable, planner, insights, reports/charts, alerts, notifications, profile/password changes, export/deletion, admin panels and server role checks. No new mock financial records in the application. Existing registration starter amounts were retained and described honestly. No bank sync, income ledger, separate savings ledger, password recovery or generative AI was advertised.

## Executed verification

- npm production build: PASS (864 modules, existing Vite CJS deprecation notice).
- Python compileall of backend: PASS with bundled complete Python interpreter. Default MySQL Python installation is unusable.
- Browser smoke suite in installed Edge: PASS after final router upgrade. Homepage widths 320/375/768/1024/1440; all public/auth direct routes; mobile public menu; mobile workspace navigation and deep-link refresh; protected redirect; invalid credentials; external next URL rejection; authenticated homepage; logout/token removal; no browser runtime errors.
- Production-build PWA suite: PASS. Worker registration, manifest root launch/icons, cached offline homepage and direct /help route.
- Desktop/mobile screenshots visually inspected: PASS. Found and corrected a 320px grid overflow during testing.
- git diff whitespace check: PASS before final documentation staging.
- Source/bundle review: no credentials added, no schema or financial-rule changes. Production bundle uses the Render backend fallback.
- npm audit: 8 findings remain (5 high, 2 moderate, 1 low) in the existing Vite/tooling/transitive dependency tree. No remaining router finding. Full fixes include a Vite major upgrade and require a separate compatibility review. See frontend/audit-results.json.

Browser authentication checks use intercepted test responses. They prove frontend behavior, not live authentication, database state, financial arithmetic, admin rejection or complete API integration.

## Production verification limits and required steps

Read-only requests to deployed /health, /ready, /api/budget, /api/admin/stats and login OPTIONS timed out. A first Node request encountered the local certificate-store configuration; using system certificates resolved that local error but requests still timed out. No claim is made that production is healthy or broken based solely on this environment.

No Vercel/Render management connector was available. Production environment values and deployments were not inspected or changed. Source now includes exact-origin CORS and Vercel rewrites, but hosting must deploy these changes before they take effect.

Before production acceptance:

1. Confirm Vercel production VITE_API_BASE_URL=https://allowanceai-backend.onrender.com and correct project root, then deploy the reviewed release.
2. Deploy backend CORS addition and confirm FRONTEND_URL=https://allowance-ai-omega.vercel.app without changing database credentials.
3. Verify health AND ready/database connectivity, CORS preflight, real registration/login/logout, token expiry, user data ownership and admin denial with authorized test accounts.
4. Exercise all preserved financial workflows against an isolated or authorized test account, including persistence and calculation correctness. No production account/data mutations were performed here.
5. Publish owner-approved Privacy Policy and Terms of Service. Current pages explicitly disclose pending policies and avoid invented legal obligations.
6. Test real browser installation, standalone navigation, service-worker update transition and iOS safe-area behavior. Local worker/offline smoke tests do not establish device installation compatibility or full WCAG conformance.
7. Review remaining dependency audit findings, especially dev-server/build-tool advisories, before broader exposure.

## Git and deployment

Release branch: codex/public-product-experience. Commit/push outcome is reported in the delivery message. No destructive database actions, secret changes, production reset or manual deployment was performed. Existing provider/GitHub deployment configuration is preserved.

