function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

export default function BudgetCards({ budget }) {
  const cards = [
    { label: "Allowance", value: budget?.allowance, tone: "safe" },
    { label: "Spent", value: budget?.total_spent, tone: "warning" },
    { label: "Remaining", value: budget?.remaining_money, tone: budget?.budget_status || "safe" },
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
