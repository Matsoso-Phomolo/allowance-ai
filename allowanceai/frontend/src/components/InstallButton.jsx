export default function InstallButton({ compact = false }) {
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
  }

  return (
    <div className={compact ? "install-control compact-install-control" : "install-control"}>
      <button
        className={compact ? "install-button compact-button" : "install-button"}
        type="button"
        onClick={handleDownload}
      >
        Download App
      </button>
      {!compact && <p className="install-message">Choose Desktop when saving so it appears with your icons.</p>}
    </div>
  );
}
