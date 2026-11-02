import { useEffect, useState } from "react";
import { itemRequest } from "../api";
import { formatMoney as money } from "../currency";

export default function ItemAnalytics() {
  const [plans, setPlans] = useState([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    itemRequest("/plans")
      .then((rows) => {
        if (alive) setPlans(rows);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const plan = plans.find((row) => row.id === Number(selected));
  return (
    <section
      className="panel item-workspace"
      aria-label="Item planning analytics"
    >
      <h2>Item planning analytics</h2>
      <p>
        Compare one plan at a time. Plans, shopping estimates and budget
        allocations are never added to actual expenses.
      </p>
      {loading && <p role="status">Loading plans…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !plans.length && (
        <p>
          No saved item plans yet. Create a monthly plan or shopping list to
          compare estimates and purchases.
        </p>
      )}
      <label>
        Compare saved plan
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.month} · {p.kind}
            </option>
          ))}
        </select>
      </label>
      {plan && (
        <>
          <div className="item-summary">
            {[
              ["Planned", plan.summary.planned_expenditure],
              ["Reserved savings", plan.reserved_savings],
              ["Actual linked purchases", plan.summary.actual_expenditure],
              ["Pending estimate", plan.summary.pending_estimate],
              ["Price variance", plan.summary.purchased_price_variance],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
          </div>
          <div className="item-comparison">
            {plan.summary.categories.map((row) => (
              <div key={row.name}>
                <strong>{row.name}</strong>
                <span>Planned {money(row.planned)}</span>
                <span>Actual {money(row.actual)}</span>
                <meter
                  aria-label={`${row.name} actual compared with planned`}
                  min="0"
                  max={Math.max(Number(row.planned), Number(row.actual), 1)}
                  value={Number(row.actual)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
