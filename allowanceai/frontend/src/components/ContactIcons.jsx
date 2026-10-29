import { useId, useState } from "react";

export default function ContactIcons() {
  const id = useId();
  const [tooltip, setTooltip] = useState(null);
  const contacts = [
    { name: "Email", kind: "email", href: "mailto:matsoso086@gmail.com" },
    { name: "WhatsApp", kind: "whatsapp", href: "https://wa.me/26657260714" },
  ];

  return (
    <div className="contact-icons" role="group" aria-label="Contact options">
      {contacts.map(({ name, kind, href }) => (
        <a
          key={kind}
          className={`contact-icon-link ${kind}`}
          href={href}
          aria-label={name}
          aria-describedby={tooltip === kind ? `${id}-${kind}` : undefined}
          onMouseEnter={() => setTooltip(kind)}
          onMouseLeave={(event) => {
            if (document.activeElement !== event.currentTarget)
              setTooltip(null);
          }}
          onFocus={() => setTooltip(kind)}
          onBlur={() => setTooltip(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTooltip(null);
          }}
        >
          {kind === "email" ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          ) : (
            <img
              src="/brand/whatsapp.svg"
              width="28"
              height="28"
              alt=""
              aria-hidden="true"
            />
          )}
          {tooltip === kind && (
            <span
              className="contact-tooltip"
              id={`${id}-${kind}`}
              role="tooltip"
            >
              {name}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
