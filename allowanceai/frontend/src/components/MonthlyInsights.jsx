function statusClass(status) {
  return String(status || "SAFE").toLowerCase();
}

function yesNo(value) {
  return value ? "Active" : "Clear";
}

export default function MonthlyInsights({ insights }) {
  if (!insights) {
    return (
      <section className="panel">
        <h2>Monthly Insights</h2>
        <p>No monthly behavior data yet.</p>
      </section>
    );
  }

  const cards = [
    ["Most expensive", insights.most_expensive_category],
    ["Fastest growing", insights.fastest_growing_category],
    ["Most frequent", insights.most_frequent_expense_type],
    ["Best behavior", insights.best_saving_behavior],
  ];

  return (
    <section className="panel monthly-insights">
      <div className="section-heading">
        <div>
          <h2>Monthly Insights</h2>
          <p>What changed this month?</p>
        </div>
        <span className={`status-pill ${statusClass(insights.status)}`}>
          {insights.status} - {insights.risk_score}/100
        </span>
      </div>

      <p className="insight-summary">{insights.what_changed_this_month}</p>

      <div className="insight-card-grid">
        {cards.map(([label, value]) => (
          <article className="insight-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="insight-explanation">
        <h3>Risk explanation</h3>
        <p>{insights.risky_behavior}</p>
        <p>{insights.risk_explanation}</p>
      </div>

      <div className="behavior-rule-grid" aria-label="Behavior analysis rules">
        <span>Repeated snacks: {yesNo(insights.metrics?.repeated_snack_spending)}</span>
        <span>Before mid-month: {yesNo(insights.metrics?.overspending_before_mid_month)}</span>
        <span>Savings protected: {yesNo(insights.metrics?.savings_protected)}</span>
        <span>Emergency used: {yesNo(insights.metrics?.emergency_used)}</span>
        <span>Category imbalance: {yesNo(insights.metrics?.category_imbalance)}</span>
      </div>

      <div className="insight-explanation">
        <h3>Month-end summary</h3>
        <p>{insights.month_end_summary}</p>
      </div>

      <div>
        <h3>Smart recommendations</h3>
        <ul className="recommendation-list">
          {insights.recommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
