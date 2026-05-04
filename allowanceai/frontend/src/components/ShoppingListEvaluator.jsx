import { useState } from "react";

function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

const blankItem = { item_name: "", amount: "", category_name: "" };

export default function ShoppingListEvaluator({ categories, onEvaluate }) {
  const [items, setItems] = useState([{ ...blankItem }]);
  const [result, setResult] = useState(null);

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addRow() {
    setItems((current) => [...current, { ...blankItem }]);
  }

  function removeRow(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      items: items.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
    };
    setResult(await onEvaluate(payload));
  }

  return (
    <section className="panel planner-panel">
      <div className="panel-heading">
        <h2>Shopping List Evaluator</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {items.map((item, index) => (
          <div className="list-item-row" key={index}>
            <input
              required
              placeholder="Item"
              value={item.item_name}
              onChange={(event) => updateItem(index, "item_name", event.target.value)}
            />
            <input
              min="1"
              required
              placeholder="Amount"
              type="number"
              value={item.amount}
              onChange={(event) => updateItem(index, "amount", event.target.value)}
            />
            <select
              required
              value={item.category_name}
              onChange={(event) => updateItem(index, "category_name", event.target.value)}
            >
              <option value="">Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            {items.length > 1 && (
              <button className="danger-button compact-button" type="button" onClick={() => removeRow(index)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button className="secondary-button" type="button" onClick={addRow}>
          Add Item
        </button>
        <button type="submit">Evaluate List</button>
      </form>

      {result && (
        <div className={`decision ${result.status ? result.status.toLowerCase() : result.approved ? "safe" : "danger"}`}>
          <strong>{result.approved ? "Approved" : "Not Affordable"} - Risk {result.risk_score ?? result.metrics?.risk_score ?? 0}/100</strong>
          <span>Total cost: {money(result.total_cost)}</span>
          <span>Money after purchase: {money(result.money_after_purchase)}</span>
          {result.confidence != null && <span>Confidence: {Math.round(result.confidence * 100)}%</span>}
          {result.reasoning && <span>{result.reasoning}</span>}
          <p>{result.advice}</p>
          {result.items_to_remove_if_not_affordable.length > 0 && (
            <div className="mini-list">
              <strong>Remove first</strong>
              {result.items_to_remove_if_not_affordable.map((item, index) => (
                <span key={`${item.item_name}-${index}`}>
                  {item.item_name} ({item.category_name}) - {money(item.amount)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
