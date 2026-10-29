# PWA installation popup release — 29 October 2026

## Changes

- Replaced the old InstallButton component with reusable PWAInstallPrompt, a shared provider and menu action. The provider is mounted once inside BrowserRouter and survives navigation.
- Removed the login inline install button/instructions and bottom developer credits from both authentication cards. Public About/footer ownership attribution remains intact.
- Eligible Chromium sessions receive one delayed homepage-only suggestion after load. No native prompt runs until the user clicks Install App. Impressions and dismissals persist in localStorage; repeated eligibility events do not create duplicate prompts.
- Public navigation, Help and the authenticated app menu expose later installation. Browsers without a deferred native event see concise browser-specific instructions without a nonfunctional native install action.
- Installed/standalone states suppress controls; appinstalled closes the popup and records installation. Same-origin installed related web apps are detected where the browser exposes them. A fresh eligibility event allows reinstall after uninstall.
- Native dialog includes application icon, named/described content, Not Now/close controls, explicit keyboard focus wrap, Escape handling and focus restoration. Responsive green design; no motion-dependent behavior.
- Native failures fall back to guidance, and a consumed native event cannot be invoked again.
- Manifest, service worker strategy, offline fallback, routing, account flows and backend code are unchanged. Cache/version identifiers bumped together to 1.2.1 for delivery.

## Verification

Production build, installation lifecycle suite, existing browser/auth/currency suite, currency unit test and production-build PWA/offline suite passed. Installation tests cover eligible delay, no unsupported automatic prompts, dismissal and impression persistence, later manual access, accepted/dismissed native results, appinstalled, standalone detection, duplicate suppression, native failure fallback, mobile/iOS guidance, clean authentication cards, keyboard wrap/Escape/focus restoration and no runtime exceptions. Popup screenshots at desktop and 320px mobile were visually inspected.

The first mobile test incorrectly waited for a hidden menu item to become accessible and was corrected to wait for its attached state. Keyboard checks exposed focus leaving the dialog's controls in Edge; explicit wrapping was added and retested. No test assertion was removed to conceal product failure.

Automated native lifecycle checks dispatch controlled browser eligibility events with prompt spies in Edge; they verify application wiring, not an actual OS installation. iOS guidance is tested with a mobile viewport/user agent, not physical Safari. A real installation on supported desktop/mobile devices and a screen-reader audit remain manual verification steps. Browser APIs cannot identify installs across all profiles/devices; disabled localStorage limits cross-refresh dismissal persistence.

Security audit remains two existing Vite/esbuild development-tool findings (one moderate, one high); no audit pass is claimed. No backend, model, database, credentials or user-data changes are included.

## Delivery

Commit/push and exact Vercel deployment status are recorded in the final delivery message after verification. Source changes preserve main history, with no force push. Existing Render readiness limitations are unchanged; this frontend-only release does not require a new backend change.
