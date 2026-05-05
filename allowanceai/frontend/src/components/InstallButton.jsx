import { useEffect, useState } from "react";

export default function InstallButton({ compact = false }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [message, setMessage] = useState("");
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent) ||
    window.matchMedia?.("(max-width: 720px)").matches;

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function getAppUrl() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "https://allowance-ai.onrender.com/"
      : window.location.origin;
  }

  function buildLauncherHtml() {
    const appUrl = getAppUrl();
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${appUrl}">
    <title>AllowanceAI</title>
    <script>window.location.replace("${appUrl}");</script>
  </head>
  <body>
    <p>Opening <a href="${appUrl}">AllowanceAI</a>...</p>
  </body>
</html>`;
  }

  async function handleDownload() {
    if (isMobile) {
      if (installPrompt) {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
        return;
      }

      const instruction =
        /iPhone|iPad|iPod/i.test(window.navigator.userAgent)
          ? "On iPhone: tap Share, then Add to Home Screen."
          : "On Android: tap the browser menu, then Add to Home screen or Install app.";
      setMessage(instruction);
      return;
    }

    const launcher = buildLauncherHtml();

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: "AllowanceAI.html",
          types: [
            {
              description: "HTML shortcut",
              accept: { "text/html": [".html"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(launcher);
        await writable.close();
        setMessage("Saved. If you chose Desktop, AllowanceAI will appear with your icons.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
      }
    }

    const blob = new Blob([launcher], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "AllowanceAI.html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Downloaded AllowanceAI.html. Move it to Desktop if you want it with your icons.");
  }

  return (
    <div className={compact ? "install-control compact-install-control" : "install-control"}>
      <button
        className={compact ? "install-button compact-button" : "install-button"}
        type="button"
        onClick={handleDownload}
      >
        {isMobile ? "Add to Screen" : "Download App"}
      </button>
      {!compact && (
        <p className="install-message">
          {message || (isMobile ? "Adds AllowanceAI to your phone home screen." : "Choose Desktop when saving so it appears with your icons.")}
        </p>
      )}
    </div>
  );
}
