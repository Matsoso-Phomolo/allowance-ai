import { useState } from "react";

import SavedShoppingLists from "./SavedShoppingLists";

function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

const blankItem = { item_name: "", amount: "", category_name: "" };

function normalizedItems(items) {
  return items.map((item) => ({
    item_name: item.item_name.trim(),
    amount: Number(item.amount),
    category_name: item.category_name,
  }));
}

function resultFromSaved(list) {
  return {
    approved: list.approved,
    total_cost: list.total_cost,
    advice: list.advice,
    risk_score: list.approved ? 20 : 80,
    status: list.approved ? "SAFE" : "DANGER",
    money_after_purchase: 0,
    confidence: null,
    reasoning: "Saved shopping list.",
    items_to_remove_if_not_affordable: [],
  };
}

export default function ShoppingListEvaluator({
  categories,
  onDeleteShoppingList,
  onEvaluate,
  onSaveShoppingList,
  onUpdateShoppingList,
  savedShoppingLists = [],
}) {
  const [items, setItems] = useState([{ ...blankItem }]);
  const [listName, setListName] = useState("");
  const [result, setResult] = useState(null);
  const [currentSavedList, setCurrentSavedList] = useState(null);
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
    setMessage("");
  }

  function addRow() {
    setItems((current) => [...current, { ...blankItem }]);
    setMessage("");
  }

  function removeRow(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setMessage("");
  }

  function resetDraft() {
    setItems([{ ...blankItem }]);
    setListName("");
    setResult(null);
    setCurrentSavedList(null);
    setIsEditingSaved(false);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = { items: normalizedItems(items) };
    const evaluation = await onEvaluate(payload);
    setResult(evaluation);
    if (!listName.trim()) {
      setListName(`Shopping list ${new Date().toLocaleDateString()}`);
    }
  }

  async function handleSave() {
    setError("");
    setMessage("");
    try {
      const saved = await onSaveShoppingList({
        name: listName.trim() || `Shopping list ${new Date().toLocaleDateString()}`,
        items: normalizedItems(items),
      });
      setCurrentSavedList(saved);
      setIsEditingSaved(false);
      setResult(resultFromSaved(saved));
      setMessage("Shopping list saved successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateSaved() {
    if (!currentSavedList) {
      return;
    }
    setError("");
    setMessage("");
    try {
      const updated = await onUpdateShoppingList(currentSavedList.id, {
        name: listName.trim() || currentSavedList.name,
        items: normalizedItems(items),
      });
      setCurrentSavedList(updated);
      setIsEditingSaved(false);
      setResult(resultFromSaved(updated));
      setMessage("Saved shopping list updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSaved(list = currentSavedList) {
    if (!list || !window.confirm(`Delete "${list.name}"?`)) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await onDeleteShoppingList(list.id);
      if (currentSavedList?.id === list.id) {
        resetDraft();
      } else {
        setMessage("Shopping list deleted.");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function loadSavedList(list, edit = false) {
    setCurrentSavedList(list);
    setIsEditingSaved(edit);
    setListName(list.name);
    setItems(list.items.map((item) => ({
      item_name: item.item_name,
      amount: String(item.amount),
      category_name: item.category_name,
    })));
    setResult(resultFromSaved(list));
    setMessage(edit ? "Editing saved shopping list." : "Saved shopping list loaded.");
    setError("");
  }

  const canSave = result && !currentSavedList;
  const canUpdate = result && currentSavedList && isEditingSaved;

  return (
    <section className="panel planner-panel shopping-list-workspace">
      <div className="panel-heading">
        <h2>Shopping List Evaluator</h2>
        {currentSavedList && <span className="pill safe">Saved</span>}
      </div>

      <form className="form shopping-list-form" onSubmit={handleSubmit}>
        <label>
          List Name
          <input
            required
            placeholder="Weekend groceries"
            value={listName}
            onChange={(event) => {
              setListName(event.target.value);
              setMessage("");
            }}
          />
        </label>

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

        <div className="shopping-list-actions">
          <button className="secondary-button" type="button" onClick={addRow}>
            Add Item
          </button>
          <button type="submit">Evaluate List</button>
          {canSave && (
            <button className="secondary-button" type="button" onClick={handleSave}>
              Save List
            </button>
          )}
          {canUpdate && (
            <button className="secondary-button" type="button" onClick={handleUpdateSaved}>
              Update Saved List
            </button>
          )}
          {currentSavedList && !isEditingSaved && (
            <>
              <button className="secondary-button" type="button" onClick={() => setIsEditingSaved(true)}>
                Edit
              </button>
              <button className="danger-button" type="button" onClick={() => handleDeleteSaved()}>
                Delete
              </button>
              <button className="secondary-button" type="button" onClick={resetDraft}>
                New List
              </button>
            </>
          )}
        </div>
      </form>

      {message && <div className="notice safe">{message}</div>}
      {error && <div className="notice danger">{error}</div>}

      {result && (
        <div className={`decision shopping-result ${result.status ? result.status.toLowerCase() : result.approved ? "safe" : "danger"}`}>
          <div className="shopping-result-heading">
            <strong>{result.approved ? "Approved" : "Not Affordable"}</strong>
            {currentSavedList && <span className="pill safe">Saved</span>}
          </div>
          <div className="shopping-result-grid">
            <span>Total cost: {money(result.total_cost)}</span>
            {result.money_after_purchase != null && <span>Money after purchase: {money(result.money_after_purchase)}</span>}
            <span>Risk: {result.risk_score ?? result.metrics?.risk_score ?? 0}/100</span>
            {result.confidence != null && <span>Confidence: {Math.round(result.confidence * 100)}%</span>}
          </div>
          {result.reasoning && <span>{result.reasoning}</span>}
          <p>{result.advice}</p>
          {result.items_to_remove_if_not_affordable?.length > 0 && (
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

      <SavedShoppingLists
        lists={savedShoppingLists}
        onDelete={handleDeleteSaved}
        onEdit={(list) => loadSavedList(list, true)}
        onView={(list) => loadSavedList(list)}
      />
    </section>
  );
}
