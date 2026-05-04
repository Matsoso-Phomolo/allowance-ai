import { useState } from "react";

export default function PasswordInput({ value, onChange, placeholder, minLength }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input
        minLength={minLength}
        required
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="icon-button password-toggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
        title={visible ? "Hide password" : "Show password"}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          {visible ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c5 0 8.8 4.4 10 8a12.2 12.2 0 0 1-3 4.6" />
              <path d="M14.1 19.8A9.8 9.8 0 0 1 12 20c-5 0-8.8-4.4-10-8a12.4 12.4 0 0 1 4.6-5.8" />
            </>
          ) : (
            <>
              <path d="M2 12s3.8-8 10-8 10 8 10 8-3.8 8-10 8-10-8-10-8Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
