function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

function dateLabel(value) {
  if (!value) {
    return "Unknown date";
  }
  return new Date(value).toLocaleDateString();
}

export default function SavedShoppingLists({ lists = [], onDelete, onEdit, onView }) {
  return (
    <section className="saved-shopping-lists">
      <div className="panel-heading">
        <h3>Saved Shopping Lists</h3>
        <span>{lists.length} saved</span>
      </div>

      {lists.length === 0 ? (
        <p className="empty-state">No saved shopping lists yet.</p>
      ) : (
        <div className="saved-list-grid">
          {lists.map((list) => (
            <article className="saved-list-card" key={list.id}>
              <div className="saved-list-card-header">
                <div>
                  <strong>{list.name}</strong>
                  <span>Created {dateLabel(list.created_at)}</span>
                </div>
                <span className={`pill ${list.approved ? "safe" : "danger"}`}>
                  {list.approved ? "Approved" : "Rejected"}
                </span>
              </div>
              <div className="saved-list-meta">
                <span>Total</span>
                <strong>{money(list.total_cost)}</strong>
              </div>
              <p>{list.advice}</p>
              <div className="saved-list-actions">
                <button className="secondary-button" type="button" onClick={() => onView(list)}>
                  View
                </button>
                <button className="secondary-button" type="button" onClick={() => onEdit(list)}>
                  Edit
                </button>
                <button className="danger-button" type="button" onClick={() => onDelete(list)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
