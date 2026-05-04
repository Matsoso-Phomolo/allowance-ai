function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

export default function SpendingTimetable({ timetable }) {
  if (!timetable) {
    return null;
  }

  const entries = Object.entries(timetable.timetable || {});

  return (
    <section className="panel planner-panel">
      <div className="panel-heading">
        <h2>Spending Timetable</h2>
        {timetable.status && <span className={`pill ${timetable.status.toLowerCase()}`}>{timetable.status}</span>}
      </div>

      {entries.length === 0 ? (
        <p className="empty-state">No Food or Snacks categories found yet.</p>
      ) : (
        <div className="timetable-list">
          {entries.map(([category, weeks]) => (
            <article className="timetable-card" key={category}>
              <strong>{category}</strong>
              <div className="week-grid">
                {weeks.map((week) => (
                  <span key={`${category}-${week.week}`}>
                    Week {week.week}: {money(week.limit)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {timetable.reasoning && <p className="form-message">{timetable.reasoning}</p>}
      <p className="form-message">{timetable.advice}</p>
    </section>
  );
}
