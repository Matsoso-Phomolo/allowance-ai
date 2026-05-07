import { useMemo, useState } from "react";

export default function NotificationCenter({
  notifications,
  onDelete,
  onMarkAllRead,
  onMarkRead,
}) {
  const [open, setOpen] = useState(false);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  async function handleOpen() {
    setOpen((current) => !current);
  }

  return (
    <div className="notification-center">
      <button
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className="notification-button"
        type="button"
        onClick={handleOpen}
      >
        <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
          <path
            d="M15 17H9m9-2v-4a6 6 0 0 0-12 0v4l-2 2h16l-2-2Zm-4 4a2 2 0 0 1-4 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-menu" aria-label="Notification center">
          <div className="notification-menu-header">
            <div>
              <h2>Notifications</h2>
              <p>In-app reminders are active. Phone push notifications are not enabled yet.</p>
            </div>
            {unreadCount > 0 && (
              <button className="ghost-button small" type="button" onClick={onMarkAllRead}>
                Read all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="empty-state">No reminders yet.</p>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <article
                  className={`notification-item ${notification.type} ${notification.is_read ? "" : "unread"}`}
                  key={notification.id}
                >
                  <div>
                    <h3>{notification.title}</h3>
                    <p>{notification.message}</p>
                    <time dateTime={notification.created_at}>
                      {new Date(notification.created_at).toLocaleString()}
                    </time>
                  </div>
                  <div className="notification-actions">
                    {!notification.is_read && (
                      <button type="button" onClick={() => onMarkRead(notification.id)}>
                        Mark read
                      </button>
                    )}
                    <button type="button" onClick={() => onDelete(notification.id)}>
                      Clear
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
