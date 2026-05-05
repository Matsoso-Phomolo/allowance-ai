import { useState } from "react";
import InstallButton from "./InstallButton";
import PasswordInput from "./PasswordInput";

export default function Login({ onLogin, onShowRegister }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await onLogin(form);
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
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Your password"
            />
          </label>
          <button type="submit">Login</button>
        </form>
        {error && <div className="notice danger">{error}</div>}
        <button className="secondary-button" type="button" onClick={onShowRegister}>
          Create Account
        </button>
        <InstallButton />
        <p className="producer-credit">Produced by Matsoso P</p>
      </section>
    </main>
  );
}
