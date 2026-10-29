# Production release check — 29 October 2026

## Outcome: production push withheld

The non-rewriting merge preserves origin/main b99873aa318fb0de5896db961befddc1d2d74064 and source 7e4bcc8b4f36df6a97b5bcde6a480e56b3fd8215. Main contained three newer login commits; they have zero net file changes relative to b5ddb74, and all remain ancestors of the merge. No merge conflicts occurred.

The user's instruction to stop on a blocking issue applies: deployed Render /health did not respond within 55 seconds, and /ready did not respond within 25 seconds. Separate Node and web checks also failed to reach the service. This does not prove a database failure, but API and database readiness cannot be established. No authenticated production financial operations were attempted. Production main is deliberately not pushed and no new deployment is claimed.

## Checks

- Merged frontend production build: PASS, 864 modules; existing Vite CJS deprecation notice.
- Backend syntax compileall: PASS, complete bundled Python.
- Browser suite initially FAILED logout twice. Diagnosis confirmed token removal but URL became /login?next=%2Fapp due to a logout/protected-guard race. Added an explicit logout intent ref so both navigation paths resolve to /. Suite then PASSED, including logout token removal and home destination. No test assertion was removed or weakened.
- Browser suite also PASSED homepage at 320/375/768/1024/1440, public routes, mobile public/workspace navigation, deep-link refresh, protected redirect, invalid credentials, safe return destination and authenticated homepage. API fixtures are intercepted only in the test harness.
- Production-build PWA suite PASSED after correction: worker registration, manifest launch, cached offline homepage, direct /help.
- Audit command exits 1: 8 existing findings (5 high, 2 moderate, 1 low). release-audit.json preserves the refreshed report. Affected packages trace to Vite/PostCSS/Babel/development tooling; nanoid and source-map-js are PostCSS dependencies, not new financial runtime code. Static dist serving does not run Vite's development server, but the findings remain unresolved build/development risks. No forced dependency upgrades performed during merge.
- Changes staged are implementation files, the minimal logout correction, a whitespace cleanup and release evidence. No .env files, credentials or database changes added. Backend diff is only the exact production CORS origin.

## Provider evidence

GitHub CLI is authenticated to Matsoso-Phomolo. GitHub connector was unavailable, so read-only CLI API queries were used. Existing origin/main b99873a has Vercel success status, description 'Deployment has completed'. GitHub deployment 7403399650 is Production for that SHA and has success status. Canonical production URL currently returns HTTP 200 and the previous 719-byte HTML, not evidence of the new homepage release.

Existing Vercel status: https://vercel.com/matsoso-phomolos-projects/allowance-ai/5czXzzNWHbE1T3zz5JmBjJ9Cft7E
Existing deployment URL: https://allowance-i7dlnjdnk-matsoso-phomolos-projects.vercel.app
Production URL: https://allowance-ai-omega.vercel.app/

Vercel CLI reports an invalid existing token after correcting the local certificate-store setup. No token was read, printed or changed. GitHub history demonstrates main→Vercel Production integration, but production environment settings cannot be inspected through that CLI session.

No Render CLI or management connector was available. Backend CORS source change requires a Render deployment unless production FRONTEND_URL already supplies the same origin. Render's auto-deploy branch/settings cannot be verified here. No deploy hook, service credential or secret was guessed or changed.

## Required to complete release

Restore/confirm Render service availability and PostgreSQL readiness through the existing authorized Render dashboard/configuration. Confirm Render main auto-deploy and Vercel production API base URL without changing credentials. Then fetch once more, preserve any newer main commits, push the reviewed merge, follow the exact merge SHA's GitHub Production status, and verify homepage/login/register/protected routes plus live CORS/API readiness. Successful registration/login and financial persistence need an authorized test account; no existing user data should be changed.

No PostgreSQL reset, migration, credentials update, force push or production account mutation occurred.
