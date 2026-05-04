import { useState } from "react";

export default function CategoryForm({ onAddCategory }) {
  const [form, setForm] = useState({ name: "", planned_amount: "" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    await onAddCategory({
      name: form.name,
      planned_amount: Number(form.planned_amount),
    });
    setForm({ name: "", planned_amount: "" });
    setMessage("Category added.");
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Add Category</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Category Name
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Transport"
          />
        </label>
        <label>
          Planned Amount
          <input
            min="0"
            required
            type="number"
            value={form.planned_amount}
            onChange={(event) => setForm({ ...form, planned_amount: event.target.value })}
            placeholder="0.00"
          />
        </label>
        <button type="submit">Add Category</button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
