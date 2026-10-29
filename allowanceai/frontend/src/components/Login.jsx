import { Link } from "react-router-dom";
import { useState } from "react";
import PasswordInput from "./PasswordInput";

export default function Login({
  onLogin,
  onShowRegister,
  offlineNotice,
  updateNotice,
}) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onLogin(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <Link to="/">← Back to home</Link>
        <p className="eyebrow">Your financial workspace</p>
        <h1>AllowanceAI</h1>
        <p>Welcome back. Keep your month on track.</p>
        {offlineNotice}
        {updateNotice}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              required
              autoComplete="email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <PasswordInput
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Your password"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : "Log in"}
          </button>
        </form>
        {error && (
          <div role="alert" className="notice danger">
            {error}
          </div>
        )}
        <button
          className="secondary-button"
          type="button"
          onClick={onShowRegister}
        >
          Create Account
        </button>
      </section>
    </main>
  );
}
