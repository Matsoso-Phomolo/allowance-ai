import { useState } from "react";

function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

export default function CategoryList({ categories, onDeleteCategory, onUpdateCategory }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", planned_amount: "" });
  const [message, setMessage] = useState("");

  function startEditing(category) {
    setMessage("");
    setEditingId(category.id);
    setForm({
      name: category.name,
      planned_amount: category.planned_amount,
    });
  }

  async function handleUpdate(event) {
    event.preventDefault();
    await onUpdateCategory(editingId, {
      name: form.name,
      planned_amount: Number(form.planned_amount),
    });
    setEditingId(null);
    setMessage("Category updated.");
  }

  async function handleDelete(category) {
    setMessage("");
    const confirmed = window.confirm(`Delete ${category.name}? Categories with expenses cannot be deleted.`);
    if (!confirmed) {
      return;
    }

    try {
      await onDeleteCategory(category.id);
      setMessage("Category deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Budget Categories</h2>
        <span>{categories.length} active</span>
      </div>

      {message && <p className="form-message category-message">{message}</p>}

      <div className="category-list">
        {categories.map((category) => (
          <article className="category-row" key={category.id}>
            {editingId === category.id ? (
              <form className="category-edit-form" onSubmit={handleUpdate}>
                <label>
                  Name
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </label>
                <label>
                  Planned
                  <input
                    min="0"
                    required
                    type="number"
                    value={form.planned_amount}
                    onChange={(event) => setForm({ ...form, planned_amount: event.target.value })}
                  />
                </label>
                <div className="category-actions">
                  <button type="submit">Save</button>
                  <button className="secondary-button" type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="category-meta">
                  <div>
                    <strong>{category.name}</strong>
                    <span>
                      {money(category.spent_amount)} of {money(category.planned_amount)}
                    </span>
                  </div>
                  <span className={`pill ${category.status}`}>{category.status_label || category.status}</span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${category.status}`}
                    style={{ width: `${Math.min(category.percentage_used, 100)}%` }}
                  />
                </div>
                <div className="category-footer">
                  <span>{category.percentage_used.toFixed(0)}% used</span>
                  <span>{money(category.remaining_amount)} left</span>
                </div>
                <div className="category-actions">
                  <button className="secondary-button" type="button" onClick={() => startEditing(category)}>
                    Edit
                  </button>
                  <button className="danger-button" type="button" onClick={() => handleDelete(category)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
