import { useEffect, useState } from "react";
export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const capture = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  async function install() {
    if (prompt) {
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } finally {
        setPrompt(null);
      }
    } else
      setMessage(
        /iPhone|iPad|iPod/.test(navigator.userAgent)
          ? "In Safari, choose Share, then Add to Home Screen."
          : "In supported Chrome or Edge browsers, choose Install app from the address bar or browser menu. You can also continue using the website.",
      );
  }
  return (
    <div className="install-control">
      <button type="button" className="install-button" onClick={install}>
        Install app
      </button>
      <p role="status" className="install-message">
        {message ||
          "Install through a supported browser. Financial features require internet access."}
      </p>
    </div>
  );
}
