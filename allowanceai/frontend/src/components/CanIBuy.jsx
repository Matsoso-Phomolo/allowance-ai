import { useState } from "react";

export default function CanIBuy({ categories, onCheck }) {
  const [form, setForm] = useState({
    item_name: "",
    amount: "",
    category_name: categories[0]?.name || "",
  });
  const [decision, setDecision] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await onCheck({
      ...form,
      amount: Number(form.amount),
    });
    setDecision(result);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Can I Buy?</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Item
          <input
            required
            value={form.item_name}
            onChange={(event) => setForm({ ...form, item_name: event.target.value })}
            placeholder="New snack, data, cosmetic item"
          />
        </label>
        <div className="form-row">
          <label>
            Amount
            <input
              min="1"
              required
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="0.00"
            />
          </label>
          <label>
            Category
            <select
              required
              value={form.category_name || categories[0]?.name || ""}
              onChange={(event) => setForm({ ...form, category_name: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit">Check Purchase</button>
      </form>

      {decision && (
        <div className={`decision ${decision.status ? decision.status.toLowerCase() : decision.approved ? "safe" : "danger"}`}>
          <strong>{decision.approved ? "Approved" : "Rejected"} {decision.risk_score != null ? `- Risk ${decision.risk_score}/100` : ""}</strong>
          <p>{decision.advice}</p>
          {decision.reasoning && <span>{decision.reasoning}</span>}
          {decision.confidence != null && <span>Confidence: {Math.round(decision.confidence * 100)}%</span>}
          <span>Money after purchase: R{decision.money_after_purchase.toFixed(2)}</span>
          <span>Category after purchase: R{decision.category_after_purchase.toFixed(2)}</span>
          {decision.recommendations?.length > 0 && (
            <div className="mini-list">
              <strong>Recommendations</strong>
              {decision.recommendations.map((item, index) => (
                <span key={`${item}-${index}`}>{item}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
