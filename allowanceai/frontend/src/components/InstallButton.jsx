export default function InstallButton({ compact = false }) {
  function handleDownload() {
    const appUrl =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "https://allowance-ai.onrender.com/"
        : window.location.origin;
    const shortcut = `[InternetShortcut]\nURL=${appUrl}\nIconFile=${appUrl}/icon.svg\nIconIndex=0\n`;
    const blob = new Blob([shortcut], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "AllowanceAI.url";
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
      {!compact && <p className="install-message">Downloads a desktop shortcut for AllowanceAI.</p>}
    </div>
  );
}
