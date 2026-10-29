import { formatMoney } from "../currency";

export default function BudgetCards({ budget, currency }) {
  if (!budget)
    return (
      <section className="panel">
        <h2>Your budget overview</h2>
        <p>
          No budget summary is available. Set up your budget below, or try again
          if loading failed.
        </p>
      </section>
    );
  const status = String(budget.budget_status || "").toLowerCase();
  const statusLabel =
    {
      unconfigured: "Not configured",
      safe: "Within budget",
      warning: "Approaching limit",
      danger:
        Number(budget.remaining_money) < 0 ? "Over budget" : "Budget at risk",
    }[status] || "Status unavailable";
  const remainingLabel =
    budget.configured === false
      ? "Not configured"
      : Number(budget.allowance) === 0 &&
          Number(budget.total_spent) === 0 &&
          budget.configured === true
        ? "Zero budget · no spending"
        : statusLabel;
  const cards = [
    { label: "Monthly budget", value: budget?.allowance, tone: "safe" },
    {
      label: "Actual expenditure",
      value: budget?.total_spent,
      tone: "neutral",
    },
    {
      label: "Remaining budget",
      value: budget?.remaining_money,
      tone: ["safe", "warning", "danger"].includes(status) ? status : "neutral",
    },
    { label: "Savings goal", value: budget?.savings_target, tone: "safe" },
    {
      label: "Planned expenditure",
      value: budget?.total_planned,
      tone: "neutral",
    },
  ];

  return (
    <section className="budget-cards">
      {cards.map((card) => (
        <article className={`stat-card ${card.tone}`} key={card.label}>
          <span>{card.label}</span>
          <strong>
            {card.value == null ? "—" : formatMoney(card.value, currency)}
          </strong>
          {card.label === "Remaining budget" && (
            <small className="budget-status">{remainingLabel}</small>
          )}
        </article>
      ))}
    </section>
  );
}
