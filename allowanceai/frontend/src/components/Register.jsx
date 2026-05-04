import { useState } from "react";
import PasswordInput from "./PasswordInput";

export default function Register({ onRegister, onShowLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await onRegister(form);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <h1>AllowanceAI</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Your name"
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <PasswordInput
              minLength="6"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="At least 6 characters"
            />
          </label>
          <button type="submit">Register</button>
        </form>
        {error && <div className="notice danger">{error}</div>}
        <button className="secondary-button" type="button" onClick={onShowLogin}>
          Back to Login
        </button>
        <p className="producer-credit">Produced by Matsoso P</p>
      </section>
    </main>
  );
}
