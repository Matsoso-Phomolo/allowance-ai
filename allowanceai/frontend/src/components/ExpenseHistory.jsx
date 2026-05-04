import { useState } from "react";

function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

export default function ExpenseHistory({ categories, expenses, onDeleteExpense, onUpdateExpense }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    item_name: "",
    amount: "",
    category_name: "",
    expense_date: "",
  });
  const [message, setMessage] = useState("");

  function startEditing(expense) {
    setMessage("");
    setEditingId(expense.id);
    setForm({
      item_name: expense.item_name,
      amount: expense.amount,
      category_name: expense.category_name,
      expense_date: expense.expense_date,
    });
  }

  async function handleUpdate(event) {
    event.preventDefault();
    await onUpdateExpense(editingId, {
      ...form,
      amount: Number(form.amount),
    });
    setEditingId(null);
    setMessage("Expense updated.");
  }

  async function handleDelete(expense) {
    setMessage("");
    const confirmed = window.confirm(`Delete ${expense.item_name} for ${money(expense.amount)}?`);
    if (!confirmed) {
      return;
    }

    await onDeleteExpense(expense.id);
    setMessage("Expense deleted.");
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Recent Expenses</h2>
        <span>{expenses.length} records</span>
      </div>

      {message && <p className="form-message category-message">{message}</p>}

      <div className="expense-list">
        {expenses.length === 0 ? (
          <p className="empty-state">No expenses yet.</p>
        ) : (
          expenses.slice(0, 12).map((expense) => (
            <article className="expense-row expense-row-editable" key={expense.id}>
              {editingId === expense.id ? (
                <form className="category-edit-form expense-edit-form" onSubmit={handleUpdate}>
                  <label>
                    Item
                    <input
                      required
                      value={form.item_name}
                      onChange={(event) => setForm({ ...form, item_name: event.target.value })}
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
                      value={form.category_name}
                      onChange={(event) => setForm({ ...form, category_name: event.target.value })}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
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
                  <div className="expense-main">
                    <div>
                      <strong>{expense.item_name}</strong>
                      <span>
                        {expense.category_name} - {expense.expense_date}
                      </span>
                    </div>
                    <strong>{money(expense.amount)}</strong>
                  </div>
                  <div className="category-actions expense-actions">
                    <button className="secondary-button" type="button" onClick={() => startEditing(expense)}>
                      Edit
                    </button>
                    <button className="danger-button" type="button" onClick={() => handleDelete(expense)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
