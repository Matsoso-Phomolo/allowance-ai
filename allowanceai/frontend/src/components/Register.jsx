import { Link } from "react-router-dom";
import { useState } from "react";
import PasswordInput from "./PasswordInput";

export default function Register({
  onRegister,
  onShowLogin,
  offlineNotice,
  updateNotice,
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onRegister(form);
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
        <p>Create your account. Start planning with clarity.</p>
        {offlineNotice}
        {updateNotice}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Your name"
            />
          </label>
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
              minLength="6"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="At least 6 characters"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : "Create account"}
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
          onClick={onShowLogin}
        >
          Back to Login
        </button>
      </section>
    </main>
  );
}
