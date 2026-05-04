import { useEffect, useMemo, useState } from "react";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function BudgetForm({ budget, onSaveBudget }) {
  const initialMonth = useMemo(() => currentMonth(), []);
  const [form, setForm] = useState({
    month: initialMonth,
    allowance: budget?.allowance || "",
    savings_target: budget?.savings_target || "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      allowance: budget?.allowance ?? "",
      savings_target: budget?.savings_target ?? "",
    }));
  }, [budget]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      await onSaveBudget({
        month: form.month,
        allowance: Number(form.allowance),
        savings_target: Number(form.savings_target),
      });
      setMessage("Budget updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Edit Budget</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Month
          <input
            required
            type="month"
            value={form.month}
            onChange={(event) => setForm({ ...form, month: event.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            Allowance
            <input
              min="1"
              required
              type="number"
              value={form.allowance}
              onChange={(event) => setForm({ ...form, allowance: event.target.value })}
              placeholder="1500"
            />
          </label>
          <label>
            Savings Target
            <input
              min="0"
              required
              type="number"
              value={form.savings_target}
              onChange={(event) => setForm({ ...form, savings_target: event.target.value })}
              placeholder="100"
            />
          </label>
        </div>
        <button disabled={saving} type="submit">
          {saving ? "Saving..." : "Save Budget"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
