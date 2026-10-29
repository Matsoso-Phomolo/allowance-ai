import { getBudget } from "../api";
import { useEffect, useMemo, useState } from "react";

function currentMonth() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetForm({ budget, onSaveBudget }) {
  const initialMonth = useMemo(() => currentMonth(), []);
  const [form, setForm] = useState({
    month: initialMonth,
    allowance: budget?.allowance ?? 0,
    savings_target: budget?.savings_target ?? 0,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fetchingMonth, setFetchingMonth] = useState(false);
  const [monthLoadError, setMonthLoadError] = useState("");
  const [reloadMonth, setReloadMonth] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const selectedMonth = form.month;
    setMonthLoadError("");
    if (!/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
      setFetchingMonth(false);
      return;
    }
    if (selectedMonth === (budget?.month || initialMonth)) {
      setFetchingMonth(false);
      setForm((current) => ({
        ...current,
        allowance: budget?.allowance ?? 0,
        savings_target: budget?.savings_target ?? 0,
      }));
      return;
    }
    setFetchingMonth(true);
    getBudget(selectedMonth)
      .then((data) => {
        if (!cancelled)
          setForm((current) => ({
            ...current,
            allowance: data.allowance,
            savings_target: data.savings_target,
          }));
      })
      .catch((error) => {
        if (!cancelled) setMonthLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setFetchingMonth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [budget, form.month, initialMonth, reloadMonth]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    if (saving || fetchingMonth || monthLoadError) return;
    setError("");
    setSaving(true);

    try {
      await onSaveBudget({
        month: form.month,
        allowance: Number(form.allowance),
        savings_target: Number(form.savings_target),
      });
      setMessage(`Budget saved for ${form.month}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Monthly budget</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <p className="form-message">
          Set an allowance and savings target for the selected month. Saving
          zero is different from leaving a budget unconfigured.
        </p>
        <label>
          Month
          <input
            required
            type="month"
            name="month"
            value={form.month}
            onChange={(event) =>
              setForm({ ...form, month: event.target.value })
            }
          />
        </label>
        <div className="form-row">
          <label>
            Allowance
            <input
              disabled={fetchingMonth || Boolean(monthLoadError)}
              min="0"
              required
              type="number"
              name="allowance"
              value={form.allowance}
              onChange={(event) =>
                setForm({ ...form, allowance: event.target.value })
              }
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <label>
            Savings Target
            <input
              disabled={fetchingMonth || Boolean(monthLoadError)}
              min="0"
              required
              type="number"
              name="savings_target"
              value={form.savings_target}
              onChange={(event) =>
                setForm({ ...form, savings_target: event.target.value })
              }
              step="0.01"
              placeholder="0.00"
            />
          </label>
        </div>
        {fetchingMonth && <p role="status">Loading the selected month…</p>}
        {monthLoadError && (
          <div role="alert" className="notice danger">
            {monthLoadError}{" "}
            <button
              type="button"
              onClick={() => setReloadMonth((value) => value + 1)}
            >
              Retry month
            </button>
          </div>
        )}
        <button
          disabled={saving || fetchingMonth || Boolean(monthLoadError)}
          type="submit"
        >
          {saving ? "Saving..." : "Save Budget"}
        </button>
        {error && (
          <p role="alert" className="notice danger">
            {error}
          </p>
        )}
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
