import { useState } from "react";

function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function MonthlyPlanner({ budget, onCreatePlan }) {
  const [form, setForm] = useState({
    allowance: budget?.allowance || 1500,
    month: currentMonth(),
    dataBundles: 250,
    mokhatlo: 200,
    savings: budget?.savings_target || 100,
    foodPriority: "medium",
    snackLevel: "medium",
    cosmeticsLevel: "medium",
  });
  const [plan, setPlan] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await onCreatePlan({
      allowance: Number(form.allowance),
      month: form.month,
      fixed_commitments: {
        "Data Bundles": Number(form.dataBundles),
        Mokhatlo: Number(form.mokhatlo),
        Savings: Number(form.savings),
      },
      user_preferences: {
        food_priority: form.foodPriority,
        snack_level: form.snackLevel,
        cosmetics_level: form.cosmeticsLevel,
      },
    });
    setPlan(result);
  }

  return (
    <section className="panel planner-panel">
      <div className="panel-heading">
        <h2>Monthly Planner</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Allowance
            <input
              min="1"
              required
              type="number"
              value={form.allowance}
              onChange={(event) => setForm({ ...form, allowance: event.target.value })}
            />
          </label>
          <label>
            Month
            <input
              required
              type="month"
              value={form.month}
              onChange={(event) => setForm({ ...form, month: event.target.value })}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Data / Contract
            <input
              min="0"
              required
              type="number"
              value={form.dataBundles}
              onChange={(event) => setForm({ ...form, dataBundles: event.target.value })}
            />
          </label>
          <label>
            Mokhatlo
            <input
              min="0"
              required
              type="number"
              value={form.mokhatlo}
              onChange={(event) => setForm({ ...form, mokhatlo: event.target.value })}
            />
          </label>
        </div>

        <label>
          Savings
          <input
            min="0"
            required
            type="number"
            value={form.savings}
            onChange={(event) => setForm({ ...form, savings: event.target.value })}
          />
        </label>

        <div className="form-row">
          <label>
            Food Priority
            <select value={form.foodPriority} onChange={(event) => setForm({ ...form, foodPriority: event.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Snack Level
            <select value={form.snackLevel} onChange={(event) => setForm({ ...form, snackLevel: event.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label>
          Cosmetics Level
          <select
            value={form.cosmeticsLevel}
            onChange={(event) => setForm({ ...form, cosmeticsLevel: event.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <button type="submit">Generate Plan</button>
      </form>

      {plan && (
        <div className="plan-result">
          <strong>Suggested split for {plan.month} - {plan.status} risk {plan.risk_score}/100</strong>
          {plan.reasoning && <p className="form-message">{plan.reasoning}</p>}
          {Object.entries(plan.suggested_budget).map(([name, amount]) => (
            <div key={name}>
              <span>{name}</span>
              <span>{money(amount)}</span>
            </div>
          ))}
          <p className="form-message">Unallocated buffer: {money(plan.unallocated)}</p>
          <div className="recommendation-list">
            {plan.recommendations.map((item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
