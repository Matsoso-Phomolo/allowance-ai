import { useEffect, useRef, useState } from "react";

export default function ExpenseForm({ userId, categories, onAddExpense }) {
  const [form, setForm] = useState({
    item_name: "",

    amount: "",

    category_name: categories[0]?.name || "",

    expense_date: new Date().toISOString().slice(0, 10),
  });

  const operationKey = useRef(null);
  const recoveryKey = `allowanceai:manual-expense:${userId}`;
  const pendingPayload = useRef(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(recoveryKey) || "null");
      if (saved) {
        pendingPayload.current = saved;
        operationKey.current = saved.operation_key;
        setForm(saved);
        setError(
          "A prior expense request may have completed. Submit the saved details again to reconcile without duplicates.",
        );
      }
    } catch {
      setError(
        "Check expense history before retrying: recovery storage is unavailable.",
      );
    }
  }, [recoveryKey]);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState("safe");

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);

    setError("");

    setMessage("");

    try {
      operationKey.current ||= crypto.randomUUID();
      const payload = pendingPayload.current || {
        ...form,
        amount: form.amount,
        operation_key: operationKey.current,
      };
      sessionStorage.setItem(recoveryKey, JSON.stringify(payload));
      pendingPayload.current = payload;
      const result = await onAddExpense(payload);
      sessionStorage.removeItem(recoveryKey);
      pendingPayload.current = null;

      operationKey.current = null;
      setForm((current) => ({
        ...current,

        item_name: "",

        amount: "",

        expense_date: new Date().toISOString().slice(0, 10),
      }));

      setMessageType(result?.feedback?.type || "safe");

      setMessage(result?.feedback?.message || "Expense added.");
    } catch (err) {
      if ([400, 404, 409, 422].includes(err.status)) {
        sessionStorage.removeItem(recoveryKey);
        pendingPayload.current = null;
        operationKey.current = null;
      }
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Add Expense</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <fieldset
          className="expense-fields"
          disabled={saving || Boolean(pendingPayload.current)}
        >
          <label>
            Item
            <input
              required

              value={form.item_name}

              onChange={(event) =>
                setForm({ ...form, item_name: event.target.value })
              }

              placeholder="Lunch, data bundle, face cream"
            />
          </label>

          <div className="form-row">
            <label>
              Amount
              <input
                min="0.01"

                required

                step="0.01"

                type="number"

                value={form.amount}

                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }

                placeholder="0.00"
              />
            </label>

            <label>
              Date
              <input
                required

                type="date"

                value={form.expense_date}

                onChange={(event) =>
                  setForm({ ...form, expense_date: event.target.value })
                }
              />
            </label>
          </div>

          <label>
            Category
            <select
              required

              value={form.category_name || categories[0]?.name || ""}

              onChange={(event) =>
                setForm({ ...form, category_name: event.target.value })
              }
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add Spending"}
        </button>

        {error && (
          <p role="alert" className="notice danger">
            {error}
          </p>
        )}

        {message && <p className={`notice ${messageType}`}>{message}</p>}
      </form>
    </section>
  );
}
