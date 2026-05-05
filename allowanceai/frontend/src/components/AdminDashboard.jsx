function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

export default function AdminDashboard({ health, stats, users }) {
  if (!stats) {
    return null;
  }

  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <h2>Admin Dashboard</h2>
        <span className={`pill ${health?.database === "ready" ? "safe" : "danger"}`}>
          {health?.database === "ready" ? "DB READY" : "CHECK DB"}
        </span>
      </div>

      <div className="admin-stats">
        <div>
          <span>Users</span>
          <strong>{stats.total_users}</strong>
        </div>
        <div>
          <span>Budgets</span>
          <strong>{stats.total_budgets}</strong>
        </div>
        <div>
          <span>Categories</span>
          <strong>{stats.total_categories}</strong>
        </div>
        <div>
          <span>Expenses</span>
          <strong>{stats.total_expenses}</strong>
        </div>
        <div>
          <span>Tracked Spending</span>
          <strong>{money(stats.total_tracked_spending)}</strong>
        </div>
        <div>
          <span>Uptime</span>
          <strong>{Math.round(health?.uptime_seconds || 0)}s</strong>
        </div>
      </div>

      <div className="admin-users">
        <h3>Users</h3>
        <div className="admin-user-list">
          {(users || []).map((user) => (
            <div key={user.id}>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <span className={`pill ${user.role === "admin" ? "warning" : "safe"}`}>{user.role}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
