import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const InstallationContext = createContext(null);
const SEEN_KEY = "allowanceai_pwa_prompt_seen_v1";
const DISMISSED_KEY = "allowanceai_pwa_install_dismissed";
const INSTALLED_KEY = "allowanceai_pwa_installed";

function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* Optional storage can be disabled. */
  }
}
function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
function installationInstructions() {
  const ua = navigator.userAgent;
  if (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "Open this website in Safari. Tap Share, then Add to Home Screen and Add.";
  }
  if (/Firefox/i.test(ua)) {
    return /Android/i.test(ua)
      ? "Open the Firefox menu and choose Install or Add to Home screen if offered."
      : "This browser may not offer app installation. Continue using the website, or open it in Chrome or Edge to install.";
  }
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|Android/i.test(ua)) {
    return "In supported versions of Safari on Mac, choose File, then Add to Dock. If unavailable, continue using the website.";
  }
  return "In Chrome or Edge, open the browser menu and look for Install AllowanceAI or Add to Home screen. If it is not offered, you can continue using the website.";
}

export function PWAInstallProvider({ children }) {
  const { pathname } = useLocation();
  const deferredPrompt = useRef(null);
  const busyRef = useRef(false);
  const autoAttempted = useRef(false);
  const [eligible, setEligible] = useState(false);
  const [installed, setInstalled] = useState(
    () => standalone() || Boolean(stored(INSTALLED_KEY)),
  );
  const [suppressed, setSuppressed] = useState(() =>
    Boolean(stored(SEEN_KEY) || stored(DISMISSED_KEY)),
  );
  const [loaded, setLoaded] = useState(
    () => document.readyState === "complete",
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    let cancelled = false;
    function available(event) {
      event.preventDefault();
      if (standalone() || deferredPrompt.current || busyRef.current) return;
      // A new eligibility event also allows reinstalling after an uninstall.
      try {
        localStorage.removeItem(INSTALLED_KEY);
      } catch {
        /* Optional storage. */
      }
      setInstalled(false);
      deferredPrompt.current = event;
      setEligible(true);
    }
    function completed() {
      remember(INSTALLED_KEY);
      deferredPrompt.current = null;
      setInstalled(true);
      setEligible(false);
      setOpen(false);
    }
    function modeChanged() {
      if (standalone()) completed();
    }
    function pageLoaded() {
      setLoaded(true);
    }
    function storageChanged(event) {
      if ([SEEN_KEY, DISMISSED_KEY].includes(event.key)) {
        setSuppressed(true);
        setOpen(false);
      }
      if (event.key === INSTALLED_KEY && event.newValue) {
        deferredPrompt.current = null;
        setInstalled(true);
        setEligible(false);
        setOpen(false);
      }
    }
    if (navigator.getInstalledRelatedApps) {
      navigator
        .getInstalledRelatedApps()
        .then((apps) => {
          if (cancelled) return;
          const hasThisApp = apps.some((app) => {
            if (app.platform !== "webapp" || !app.url) return false;
            try {
              return (
                new URL(app.url, window.location.origin).origin ===
                window.location.origin
              );
            } catch {
              return false;
            }
          });
          if (hasThisApp) completed();
        })
        .catch(() => {
          /* Not every browser exposes installed-app information. */
        });
    }
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", completed);
    window.addEventListener("load", pageLoaded);
    window.addEventListener("storage", storageChanged);
    media.addEventListener("change", modeChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", completed);
      window.removeEventListener("load", pageLoaded);
      window.removeEventListener("storage", storageChanged);
      media.removeEventListener("change", modeChanged);
    };
  }, []);

  useEffect(() => {
    if (
      pathname !== "/" ||
      !loaded ||
      !eligible ||
      installed ||
      suppressed ||
      open ||
      autoAttempted.current
    )
      return;
    const timer = window.setTimeout(() => {
      autoAttempted.current = true;
      if (stored(SEEN_KEY) || stored(DISMISSED_KEY) || standalone()) return;
      // Do not steal focus from someone already using the page with a keyboard.
      if (
        ![document.body, document.documentElement].includes(
          document.activeElement,
        )
      )
        return;
      remember(SEEN_KEY);
      setSuppressed(true);
      setOpen(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [pathname, loaded, eligible, installed, suppressed, open]);

  // Automatic suggestions never follow a visitor into an authentication form.
  useEffect(() => {
    setOpen(false);
    setError("");
  }, [pathname]);

  function dismiss() {
    remember(DISMISSED_KEY);
    setSuppressed(true);
    setOpen(false);
    setError("");
  }
  function openManually() {
    if (installed || standalone()) return;
    remember(SEEN_KEY);
    setSuppressed(true);
    setError("");
    setOpen(true);
  }
  async function install() {
    const prompt = deferredPrompt.current;
    if (!prompt || busyRef.current || installed || standalone()) return;
    busyRef.current = true;
    deferredPrompt.current = null;
    setBusy(true);
    try {
      // Invoked synchronously by the Install App button's click handler.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setOpen(false);
      } else {
        dismiss();
      }
    } catch {
      setError(
        "The browser could not open installation. Use the browser menu instructions below.",
      );
    } finally {
      busyRef.current = false;
      setEligible(false);
      setBusy(false);
    }
  }

  return (
    <InstallationContext.Provider value={{ eligible, installed, openManually }}>
      {children}
      {open && !installed && (
        <PWAInstallPrompt
          eligible={eligible}
          busy={busy}
          error={error}
          onInstall={install}
          onDismiss={dismiss}
        />
      )}
    </InstallationContext.Provider>
  );
}

export function PWAInstallAction({ className = "install-menu-action" }) {
  const installation = useContext(InstallationContext);
  if (!installation || installation.installed) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={installation.openManually}
      aria-haspopup="dialog"
    >
      {installation.eligible ? "Install App" : "Install App · help"}
    </button>
  );
}

export default function PWAInstallPrompt({
  eligible,
  busy,
  error,
  onInstall,
  onDismiss,
}) {
  const dialog = useRef(null);
  const dismissButton = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const modal = dialog.current;
    modal.showModal();
    dismissButton.current?.focus();
    return () => {
      modal.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  function containKeyboardFocus(event) {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialog.current.querySelectorAll(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex='0']",
      ),
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return (
    <dialog
      onKeyDown={containKeyboardFocus}
      ref={dialog}
      className="pwa-install-dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onDismiss();
      }}
    >
      <div className="pwa-install-content">
        <button
          className="pwa-install-close"
          type="button"
          aria-label="Close installation popup"
          onClick={onDismiss}
          disabled={busy}
        >
          ×
        </button>
        <img
          className="pwa-install-icon"
          src="/icon-192.png"
          width="64"
          height="64"
          alt=""
        />
        <p className="eyebrow">Your budget, within reach</p>
        <h2 id="pwa-install-title">Install AllowanceAI</h2>
        <p id="pwa-install-description">
          Access your personal budgeting workspace directly from your device's
          home screen.
        </p>
        {error && (
          <p className="notice danger" role="alert">
            {error}
          </p>
        )}
        {!eligible && (
          <p className="pwa-install-instructions">
            {installationInstructions()}
          </p>
        )}
        <div className="pwa-install-actions">
          {eligible && (
            <button type="button" onClick={onInstall} disabled={busy}>
              {busy ? "Opening installer…" : "Install App"}
            </button>
          )}
          <button
            ref={dismissButton}
            className="secondary-button"
            type="button"
            onClick={onDismiss}
            disabled={busy}
          >
            {eligible ? "Not Now" : "Close"}
          </button>
        </div>
        <p className="small-note">
          Financial features require an internet connection.
        </p>
      </div>
    </dialog>
  );
}
