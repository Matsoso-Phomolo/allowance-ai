import { useEffect, useRef, useState } from "react";
import { itemRequest } from "../api";
import { formatMoney as money, plannedItemTotal } from "../currency";

const today = () => new Date().toLocaleDateString("en-CA");
const monthNow = () =>
  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const blankItem = () => ({
  item_name: "",
  description: "",
  package_size: "1",
  measurement_unit: "each",
  package_type: "piece",
  quantity: "1",
  estimated_unit_price: "0",
  category_id: "",
  category_name: "",
  priority: "normal",
  planned_date: "",
  state: "active",
});
const itemPayload = (item) => ({
  ...Object.fromEntries(
    Object.keys(blankItem()).map((key) => [key, item[key]]),
  ),
  category_id: item.category_id ? Number(item.category_id) : null,
  category_name: item.category_name || null,
  planned_date: item.planned_date || null,
});

export default function ItemWorkspace({
  kind,
  userId,
  budget,
  onRefresh,
  legacyLists = [],
}) {
  const [plans, setPlans] = useState([]),
    [plan, setPlan] = useState(null);
  const [header, setHeader] = useState({
    name: "",
    month: monthNow(),
    allowance: "0",
    reserved_savings: "0",
  });
  const [draft, setDraft] = useState(blankItem),
    [editing, setEditing] = useState(null);
  const [suggestion, setSuggestion] = useState(null),
    [categories, setCategories] = useState([]);
  const [selection, setSelection] = useState({}),
    [purchaseDate, setPurchaseDate] = useState(today);
  const [preview, setPreview] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const suggestionRequest = useRef(0),
    editor = useRef(null),
    review = useRef(null);
  const recoveryKey = `allowanceai:purchase:${userId}:${kind}`;
  const heading = kind === "monthly" ? "Monthly Planner" : "Shopping Lists";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      itemRequest(`/plans?kind=${kind}`),
      itemRequest("/categories"),
    ])
      .then(([rows, cats]) => {
        if (alive) {
          setPlans(rows);
          setCategories(cats);
          try {
            const pending = JSON.parse(
              sessionStorage.getItem(recoveryKey) || "null",
            );
            if (pending) {
              const saved = rows.find((row) => row.id === pending.planId);
              if (saved) {
                open(saved);
                setPreview(pending.preview);
                setMessage(
                  "A confirmation may have completed. Retry the saved confirmation to reconcile it safely.",
                );
              }
            }
          } catch {
            setError(
              "Could not restore confirmation recovery data. Check purchase history before creating another purchase.",
            );
          }
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      suggestionRequest.current++;
    };
  }, [kind, recoveryKey]);

  function open(value) {
    setPlan(value);
    setHeader(
      value
        ? {
            name: value.name,
            month: value.month,
            allowance: value.allowance,
            reserved_savings: value.reserved_savings,
          }
        : {
            name: "",
            month: monthNow(),
            allowance: String(budget?.allowance ?? 0),
            reserved_savings: String(budget?.savings_target ?? 0),
          },
    );
    setSelection({});
    setPreview(null);
    setDraft(blankItem());
    setEditing(null);
    setSuggestion(null);
    setError("");
    setMessage("");
    suggestionRequest.current++;
  }
  function accept(value) {
    setPreview(null);
    setPlan(value);
    setPlans((rows) => [value, ...rows.filter((row) => row.id !== value.id)]);
  }
  async function act(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshFinancials() {
    setCategories(await itemRequest("/categories"));
    await onRefresh?.();
  }
  function saveHeader(event) {
    event.preventDefault();
    act(async () => {
      const value = await itemRequest(
        plan ? `/plans/${plan.id}` : "/plans",
        plan ? "PUT" : "POST",
        { ...header, kind, ...(plan ? { version: plan.version } : {}) },
      );
      accept(value);
      setMessage("Plan saved. No expense has been created.");
    });
  }
  async function suggest() {
    if (!draft.item_name.trim()) return;
    const request = ++suggestionRequest.current;
    try {
      const value = await itemRequest("/items/suggest-category", "POST", {
        item_name: draft.item_name,
        description: draft.description,
      });
      if (request === suggestionRequest.current) setSuggestion(value);
    } catch (e) {
      if (request === suggestionRequest.current) setError(e.message);
    }
  }
  function saveItem(event) {
    event.preventDefault();
    act(async () => {
      const payload = itemPayload(draft);
      const value = await itemRequest(
        `/plans/${plan.id}/items${editing ? `/${editing}` : ""}`,
        editing ? "PUT" : "POST",
        editing
          ? { ...payload, version: plan.version }
          : { version: plan.version, items: [payload] },
      );
      accept(value);
      setDraft(blankItem());
      setEditing(null);
      setSuggestion(null);
      setPreview(null);
      setSelection({});
      await refreshFinancials();
      setMessage("Item saved. Its estimate is separate from actual spending.");
    });
  }
  function updateState(item, state) {
    act(async () => {
      accept(
        await itemRequest(`/plans/${plan.id}/items/${item.id}`, "PUT", {
          ...itemPayload({ ...item, category_name: "" }),
          state,
          version: plan.version,
        }),
      );
      setSelection({});
      setPreview(null);
    });
  }
  function reorder(index, offset) {
    const ids = plan.items.map((item) => item.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    act(async () =>
      accept(
        await itemRequest(`/plans/${plan.id}/reorder`, "POST", {
          version: plan.version,
          item_ids: ids,
        }),
      ),
    );
  }
  function edit(item) {
    suggestionRequest.current++;
    setEditing(item.id);
    setDraft({
      ...itemPayload(item),
      category_name: "",
      category_id: item.category_id || "",
      planned_date: item.planned_date || "",
    });
    setSuggestion(null);
    editor.current?.scrollIntoView({ block: "start" });
    editor.current?.querySelector("input")?.focus();
  }
  function changeSelection(id, field, value) {
    setSelection((rows) => ({
      ...rows,
      [id]: { ...rows[id], [field]: value },
    }));
    setPreview(null);
  }
  function reviewPurchase(event) {
    event.preventDefault();
    act(async () => {
      const pending = JSON.parse(sessionStorage.getItem(recoveryKey) || "null");
      if (pending) {
        const original = plans.find((row) => row.id === pending.planId);
        if (!original)
          throw new Error(
            "Reload saved data to reconcile the pending confirmation first.",
          );
        open(original);
        setPreview(pending.preview);
        setMessage(
          "Resolve the saved pending confirmation before reviewing another purchase.",
        );
        return;
      }
      const payload = {
        version: plan.version,
        idempotency_key: crypto.randomUUID(),
        purchase_date: purchaseDate,
        items: Object.entries(selection).map(([id, value]) => ({
          item_id: Number(id),
          quantity: value.quantity,
          actual_unit_price: value.price,
        })),
      };
      const value = await itemRequest(
        `/plans/${plan.id}/purchase-preview`,
        "POST",
        payload,
      );
      setPreview({ ...value, payload });
      requestAnimationFrame(() => review.current?.focus());
    });
  }
  function confirmPurchase() {
    act(async () => {
      sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({ planId: plan.id, preview }),
      );
      let result;
      try {
        result = await itemRequest(
          `/plans/${plan.id}/purchases`,
          "POST",
          preview.payload,
        );
      } catch (error) {
        if ([400, 404, 409, 422].includes(error.status)) {
          sessionStorage.removeItem(recoveryKey);
          setPreview(null);
        }
        throw error;
      }
      sessionStorage.removeItem(recoveryKey);
      accept(result.plan);
      setSelection({});
      setPreview(null);
      await refreshFinancials();
      setMessage(
        "Purchase confirmed. Only purchased quantities were recorded as expenses.",
      );
    });
  }
  const approximateTotal = plannedItemTotal(
    draft.quantity || "0",
    draft.estimated_unit_price || "0",
  );
  const fractional =
    ["loose", "service"].includes(draft.package_type) &&
    draft.measurement_unit !== "each";

  return (
    <section className="item-workspace" aria-label={heading}>
      <div className="item-heading">
        <div>
          <h2>{heading}</h2>
          <p>Plan once. Review actual purchases. Keep the rest pending.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => open(null)}
        >
          New {kind === "monthly" ? "plan" : "list"}
        </button>
      </div>
      {loading && <p role="status">Loading saved plans…</p>}
      {error && (
        <div className="notice danger" role="alert">
          {error}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const rows = await itemRequest(`/plans?kind=${kind}`);
                setPlans(rows);
                if (plan) open(rows.find((row) => row.id === plan.id) || null);
              })
            }
          >
            Reload saved data
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="notice safe">
          {message}
        </p>
      )}
      <label className="item-saved-selector">
        Open saved {kind === "monthly" ? "plan" : "list"}
        <select
          disabled={busy || loading}
          value={plan?.id || ""}
          onChange={(e) =>
            open(plans.find((row) => row.id === Number(e.target.value)) || null)
          }
        >
          <option value="">New draft</option>
          {plans.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.month}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={saveHeader} className="panel form item-plan-form">
        <label>
          {kind === "monthly" ? "Plan name" : "List name"}
          <input
            required
            maxLength={160}
            value={header.name}
            onChange={(e) => setHeader({ ...header, name: e.target.value })}
          />
        </label>
        <div className="item-form-grid">
          <label>
            Month
            <input
              required
              type="month"
              value={header.month}
              onChange={(e) => setHeader({ ...header, month: e.target.value })}
            />
          </label>
          <label>
            Available allowance
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={header.allowance}
              onChange={(e) =>
                setHeader({ ...header, allowance: e.target.value })
              }
            />
          </label>
          <label>
            Reserved savings
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={header.reserved_savings}
              onChange={(e) =>
                setHeader({ ...header, reserved_savings: e.target.value })
              }
            />
          </label>
        </div>
        <p>
          Saving this plan never changes your budget or records spending.
          Savings are reserved separately.
        </p>
        <button disabled={busy || loading} type="submit">
          {busy
            ? "Working…"
            : plan
              ? "Save plan settings"
              : "Create item workspace"}
        </button>
      </form>
      {plan && (
        <>
          <div className="item-summary" aria-label="Plan summary">
            {[
              ["Planned expenditure", plan.summary.planned_expenditure],
              ["Reserved savings", plan.reserved_savings],
              ["Projected remaining", plan.summary.expected_remaining],
              ["Actual purchases", plan.summary.actual_expenditure],
              ["Pending estimate", plan.summary.pending_estimate],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
          </div>
          {plan.summary.over_allocated && (
            <p className="notice danger" role="status">
              Over allocated: planned spending plus savings exceed this plan’s
              allowance.
            </p>
          )}
          {kind === "monthly" && (
            <details className="panel">
              <summary>Apply allocations to my budget</summary>
              <p>
                This replaces the selected month’s allowance/savings target and
                the allocations for categories included in this plan. Other
                allocations for the selected month remain. Other months are
                unchanged. No expenses are created.
              </p>
              <button
                disabled={busy}
                type="button"
                onClick={() =>
                  act(async () => {
                    const result = await itemRequest(
                      `/plans/${plan.id}/apply-budget`,
                      "POST",
                      { version: plan.version },
                    );
                    accept(result.plan);
                    await refreshFinancials();
                    setMessage(result.message);
                  })
                }
              >
                Apply proposed allocations
              </button>
            </details>
          )}
          <form
            className="panel form"
            ref={editor}
            onSubmit={saveItem}
            aria-label="Item entry"
          >
            <h3>{editing ? "Edit planned item" : "Add planned item"}</h3>
            <label>
              Item name
              <input
                required
                maxLength={160}
                value={draft.item_name}
                onBlur={suggest}
                onChange={(e) => {
                  suggestionRequest.current++;
                  setSuggestion(null);
                  setDraft({ ...draft, item_name: e.target.value });
                }}
              />
            </label>
            <label>
              Product description
              <input
                maxLength={1000}
                value={draft.description}
                onBlur={suggest}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="item-form-grid">
              <label>
                Package size
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={draft.package_size}
                  onChange={(e) =>
                    setDraft({ ...draft, package_size: e.target.value })
                  }
                />
              </label>
              <label>
                Measurement unit
                <select
                  value={draft.measurement_unit}
                  onChange={(e) =>
                    setDraft({ ...draft, measurement_unit: e.target.value })
                  }
                >
                  {["each", "kg", "g", "l", "ml", "m", "hour"].map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
              <label>
                Package type
                <select
                  value={draft.package_type}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      package_type: e.target.value,
                      ...(e.target.value === "loose"
                        ? { package_size: "1" }
                        : {}),
                    })
                  }
                >
                  {[
                    "piece",
                    "bag",
                    "bottle",
                    "box",
                    "pack",
                    "carton",
                    "loose",
                    "service",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="item-form-grid">
              <label>
                Planned purchase quantity
                <input
                  required
                  type="number"
                  min={fractional ? "0.001" : "1"}
                  step={fractional ? "0.001" : "1"}
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft({ ...draft, quantity: e.target.value })
                  }
                />
              </label>
              <label>
                Estimated price per purchasable unit
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.estimated_unit_price}
                  onChange={(e) =>
                    setDraft({ ...draft, estimated_unit_price: e.target.value })
                  }
                />
              </label>
              <div className="item-draft-total">
                <span>Estimated total</span>
                <strong>{money(approximateTotal)}</strong>
                <small>Final total calculated by server.</small>
              </div>
            </div>
            <p>
              Packaged goods: quantity counts packages, not their size. Loose
              goods: size is 1 and price is per selected measurement unit.
            </p>
            <label>
              Category
              <select
                value={draft.category_id}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category_id: e.target.value,
                    category_name: "",
                  })
                }
              >
                <option value="">Suggest automatically</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {!draft.category_id && (
              <label>
                New category or correction (optional)
                <input
                  maxLength={160}
                  value={draft.category_name || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, category_name: e.target.value })
                  }
                />
              </label>
            )}
            {suggestion && !draft.category_id && !draft.category_name && (
              <p role="status">
                {suggestion.category_name
                  ? `Suggestion: ${suggestion.category_name} (${suggestion.source.replaceAll("_", " ")}). ${suggestion.new_category_recommended ? "A zero-allocation category will be created when saved." : "Existing category will be reused."}`
                  : `Needs your review: ${suggestion.alternatives?.join(", ") || "no confident match"}. Choose or name a category.`}
              </p>
            )}
            <div className="item-form-grid">
              <label>
                Priority
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: e.target.value })
                  }
                >
                  {["essential", "normal", "optional"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Planned date (optional)
                <input
                  type="date"
                  value={draft.planned_date || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, planned_date: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="item-actions">
              <button disabled={busy} type="submit">
                {editing ? "Save item changes" : "Add item"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditing(null);
                    setDraft(blankItem());
                  }}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>
          <section className="panel" aria-label="Planned items">
            <h3>Planned items · {plan.items.length}</h3>
            {!plan.items.length && (
              <p>No items yet. Add your first purchase above.</p>
            )}
            <div className="item-list">
              {plan.items.map((item, index) => (
                <article key={item.id} className="item-row">
                  <div className="item-row-heading">
                    <label className="item-select">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.item_name} for purchase`}
                        disabled={
                          busy ||
                          item.state !== "active" ||
                          Number(item.remaining_quantity) <= 0
                        }
                        checked={Boolean(selection[item.id])}
                        onChange={(e) => {
                          setSelection((rows) => {
                            const next = { ...rows };
                            if (e.target.checked)
                              next[item.id] = {
                                quantity: item.remaining_quantity,
                                price: item.estimated_unit_price,
                              };
                            else delete next[item.id];
                            return next;
                          });
                          setPreview(null);
                        }}
                      />
                      <strong>{item.item_name}</strong>
                    </label>
                    <span className="item-status">{item.status}</span>
                  </div>
                  <p>
                    {item.description} · {item.package_size}{" "}
                    {item.measurement_unit} {item.package_type} ·{" "}
                    {item.quantity} × {money(item.estimated_unit_price)}
                  </p>
                  <p>
                    {item.category_name || "Category needs review"} ·{" "}
                    {item.priority}
                    {item.planned_date && ` · ${item.planned_date}`}
                  </p>
                  <dl className="item-amounts">
                    <div>
                      <dt>Planned</dt>
                      <dd>{money(item.planned_total)}</dd>
                    </div>
                    <div>
                      <dt>Purchased</dt>
                      <dd>{item.purchased_quantity}</dd>
                    </div>
                    <div>
                      <dt>Remaining quantity</dt>
                      <dd>{item.remaining_quantity}</dd>
                    </div>
                    <div>
                      <dt>Actual</dt>
                      <dd>{money(item.actual_total)}</dd>
                    </div>
                  </dl>
                  <div className="item-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => edit(item)}
                    >
                      Edit {item.item_name}
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => reorder(index, -1)}
                      aria-label={`Move ${item.item_name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === plan.items.length - 1}
                      onClick={() => reorder(index, 1)}
                      aria-label={`Move ${item.item_name} down`}
                    >
                      ↓
                    </button>
                    {item.state === "active" ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateState(item, "skipped")}
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateState(item, "cancelled")}
                        >
                          Cancel item
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateState(item, "active")}
                      >
                        Reopen item
                      </button>
                    )}
                    {Number(item.purchased_quantity) === 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            accept(
                              await itemRequest(
                                `/plans/${plan.id}/items/${item.id}`,
                                "DELETE",
                                { version: plan.version },
                              ),
                            );
                            setSelection({});
                            setPreview(null);
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          {Object.keys(selection).length > 0 && (
            <form
              className="panel form item-purchase"
              onSubmit={reviewPurchase}
            >
              <h3>Review purchased quantities</h3>
              <p>
                Enter what you actually bought. Unpurchased quantities remain
                pending.
              </p>
              <label>
                Purchase date
                <input
                  required
                  type="date"
                  max={today()}
                  value={purchaseDate}
                  onChange={(e) => {
                    setPurchaseDate(e.target.value);
                    setPreview(null);
                  }}
                />
              </label>
              {Object.entries(selection).map(([id, value]) => {
                const item = plan.items.find((row) => row.id === Number(id));
                return (
                  <fieldset key={id}>
                    <legend>{item.item_name}</legend>
                    <div className="item-form-grid">
                      <label>
                        Purchased quantity
                        <input
                          required
                          type="number"
                          step={
                            ["loose", "service"].includes(item.package_type) &&
                            item.measurement_unit !== "each"
                              ? "0.001"
                              : "1"
                          }
                          min={
                            ["loose", "service"].includes(item.package_type) &&
                            item.measurement_unit !== "each"
                              ? "0.001"
                              : "1"
                          }
                          max={item.remaining_quantity}
                          value={value.quantity}
                          onChange={(e) =>
                            changeSelection(id, "quantity", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Actual unit price
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={value.price}
                          onChange={(e) =>
                            changeSelection(id, "price", e.target.value)
                          }
                        />
                      </label>
                    </div>
                  </fieldset>
                );
              })}
              <button type="submit" disabled={busy}>
                Review actual total
              </button>
            </form>
          )}
          {preview && (
            <section
              className="panel item-confirmation"
              ref={review}
              tabIndex={-1}
              aria-label="Purchase confirmation"
            >
              <h3>Confirm actual purchase</h3>
              <ul>
                {preview.items.map((item, index) => (
                  <li key={index}>
                    {item.item_name} · {item.quantity} · {money(item.total)}
                  </li>
                ))}
              </ul>
              <strong>Actual total: {money(preview.total)}</strong>
              <p>
                This creates linked expenses for these quantities only.
                Confirmed history cannot be edited or deleted.
              </p>
              <div className="item-actions">
                <button type="button" disabled={busy} onClick={confirmPurchase}>
                  Confirm purchase
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setPreview(null)}
                >
                  Back to quantities
                </button>
              </div>
            </section>
          )}
          <section className="panel">
            <h3>Plan versus actual</h3>
            <p>
              Actual totals below contain linked purchases only. Other expenses
              stay in the main financial reports.
            </p>
            <div className="item-comparison">
              {plan.summary.categories.map((row) => (
                <div key={row.name}>
                  <strong>{row.name}</strong>
                  <span>Planned {money(row.planned)}</span>
                  <span>Purchased {money(row.actual)}</span>
                </div>
              ))}
            </div>
            <p>
              Price variance on purchased quantities:{" "}
              {money(plan.summary.purchased_price_variance)} (positive means
              higher actual prices).
            </p>
          </section>
          <section className="panel">
            <h3>Purchase history</h3>
            {!plan.purchases.length && (
              <p>No purchases confirmed. Estimates are not expenses.</p>
            )}
            {plan.purchases.map((event) => (
              <details key={event.id}>
                <summary>
                  {event.purchase_date} · {money(event.total)} · Purchase #
                  {event.id}
                </summary>
                <ul>
                  {event.items.map((item) => (
                    <li key={item.expense_id}>
                      {item.item_name} · {item.package_description} ·{" "}
                      {item.quantity} × {money(item.actual_unit_price)} ={" "}
                      {money(item.total)} · {item.category_name} · Expense #
                      {item.expense_id}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        </>
      )}
      {kind === "shopping" && legacyLists.length > 0 && (
        <details className="panel">
          <summary>Import an existing shopping list</summary>
          <p>
            Old lists did not store quantities or package sizes. Each old row
            imports as one unit at its original total price. Review package
            details before confirming purchases. The original list remains
            unchanged.
          </p>
          {legacyLists.map((list) => (
            <div className="item-actions" key={list.id}>
              <span>{list.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const value = await itemRequest(
                      `/shopping-lists/${list.id}/import-items`,
                      "POST",
                      {},
                    );
                    open(value);
                    accept(value);
                    await refreshFinancials();
                  })
                }
              >
                Import {list.name}
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
