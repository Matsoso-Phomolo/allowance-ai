import { useEffect, useState } from "react";
import PasswordInput from "./PasswordInput";

export default function ProfileSettings({ user, onUpdatePassword, onUpdateProfile }) {
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile({ name: user?.name || "", email: user?.email || "" });
  }, [user]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await onUpdateProfile(profile);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await onUpdatePassword(passwords);
      setPasswords({ current_password: "", new_password: "" });
      setMessage("Password updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel profile-panel">
      <div className="panel-heading">
        <h2>Profile Settings</h2>
        <span>{user?.email}</span>
      </div>

      {message && <div className="notice safe">{message}</div>}
      {error && <div className="notice danger">{error}</div>}

      <form className="form" onSubmit={handleProfileSubmit}>
        <label>
          Name
          <input
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
            placeholder="Your name"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={profile.email}
            onChange={(event) => setProfile({ ...profile, email: event.target.value })}
            placeholder="you@example.com"
            required
          />
        </label>
        <button type="submit">Save Profile</button>
      </form>

      <form className="form password-form" onSubmit={handlePasswordSubmit}>
        <h3>Change Password</h3>
        <label>
          Current Password
          <PasswordInput
            value={passwords.current_password}
            onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })}
            placeholder="Current password"
          />
        </label>
        <label>
          New Password
          <PasswordInput
            minLength="6"
            value={passwords.new_password}
            onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })}
            placeholder="New password"
          />
        </label>
        <button className="secondary-button" type="submit">Update Password</button>
      </form>
    </section>
  );
}
