import { useState } from "react";

export default function ExpenseForm({ categories, onAddExpense }) {
  const [form, setForm] = useState({
    item_name: "",
    amount: "",
    category_name: categories[0]?.name || "",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("safe");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    const result = await onAddExpense({
      ...form,
      amount: Number(form.amount),
    });
    setForm((current) => ({
      ...current,
      item_name: "",
      amount: "",
      expense_date: new Date().toISOString().slice(0, 10),
    }));
    setMessageType(result?.feedback?.type || "safe");
    setMessage(result?.feedback?.message || "Expense added.");
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Add Expense</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Item
          <input
            required
            value={form.item_name}
            onChange={(event) => setForm({ ...form, item_name: event.target.value })}
            placeholder="Lunch, data bundle, face cream"
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
            Date
            <input
              required
              type="date"
              value={form.expense_date}
              onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
            />
          </label>
        </div>
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
        <button type="submit">Add Spending</button>
        {message && <p className={`notice ${messageType}`}>{message}</p>}
      </form>
    </section>
  );
}
