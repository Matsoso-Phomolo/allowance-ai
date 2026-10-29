function money(value = 0) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value));
}

export default function BudgetCards({ budget }) {
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
  const cards = [
    { label: "Allowance", value: budget?.allowance, tone: "safe" },
    { label: "Spent", value: budget?.total_spent, tone: "warning" },
    {
      label: "Remaining",
      value: budget?.remaining_money,
      tone: budget?.budget_status || "safe",
    },
    { label: "Savings Target", value: budget?.savings_target, tone: "safe" },
  ];

  return (
    <section className="budget-cards">
      {cards.map((card) => (
        <article className={`stat-card ${card.tone}`} key={card.label}>
          <span>{card.label}</span>
          <strong>{money(card.value)}</strong>
        </article>
      ))}
    </section>
  );
}
