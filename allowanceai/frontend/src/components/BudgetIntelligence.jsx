function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

function badgeTone(status = "SAFE") {
  const normalized = status.toLowerCase();
  if (normalized === "danger") return "danger";
  if (normalized === "warning") return "warning";
  return "safe";
}

export default function BudgetIntelligence({ intelligence }) {
  if (!intelligence) {
    return null;
  }

  const healthTone = badgeTone(intelligence.budget_health);

  return (
    <section className="panel intelligence-panel">
      <div className="panel-heading">
        <h2>Budget Intelligence</h2>
        <span className={`pill ${healthTone}`}>{intelligence.budget_health}</span>
      </div>

      <div className="intelligence-metrics">
        <div>
          <span>Risk Score</span>
          <strong>{intelligence.risk_score ?? intelligence.metrics?.risk_score ?? 0}/100</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{Math.round((intelligence.confidence || 0) * 100)}%</strong>
        </div>
        <div>
          <span>Remaining Days</span>
          <strong>{intelligence.remaining_days}</strong>
        </div>
        <div>
          <span>Safe Per Day</span>
          <strong>{money(intelligence.safe_daily_spend)}</strong>
        </div>
        <div>
          <span>Current Speed</span>
          <strong>{money(intelligence.current_daily_spend)}</strong>
        </div>
        <div>
          <span>Month-End Projection</span>
          <strong>{money(intelligence.projected_month_end_balance)}</strong>
        </div>
      </div>

      <div className={`notice ${intelligence.spending_too_fast ? "warning" : "safe"}`}>
        {intelligence.spending_too_fast
          ? "You are spending faster than your safe daily limit."
          : "Your current spending speed is within the safe daily limit."}
      </div>
      {intelligence.reasoning && <p className="form-message">{intelligence.reasoning}</p>}

      <div className="intelligence-block">
        <h3>AI Recommendations</h3>
        <div className="recommendation-list">
          {intelligence.recommendations.map((recommendation, index) => (
            <p key={`${recommendation}-${index}`}>{recommendation}</p>
          ))}
        </div>
      </div>

      <div className="intelligence-block">
        <h3>Category Survival</h3>
        <div className="category-survival-list">
          {intelligence.category_predictions.map((category) => (
            <article className="survival-row" key={category.name}>
              <div>
                <strong>{category.name}</strong>
                <span>
                  {category.spending_pattern === "Repeat-use"
                    ? `${category.priority} - safe ${money(category.safe_daily_spend)}/day, now ${money(
                        category.current_daily_spend
                      )}/day`
                    : `${category.priority} - ${category.spending_pattern}, remaining ${money(
                        category.remaining_amount
                      )}`}
                </span>
              </div>
              <span className={`pill ${badgeTone(category.survival_status)}`}>
                {category.survival_status} {category.risk_score}/100
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
