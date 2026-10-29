import BudgetCards from "./BudgetCards";
import WorkspaceIcon from "./WorkspaceIcon";
import { formatMoney as money } from "../currency";
import {
  isBudgetConfigured,
  monthlyExpenses,
  workspaceMonth,
} from "../workspaceData";

export default function WorkspaceOverview({
  budget,
  categories,
  expenses,
  monthlyInsights,
  onNavigate,
}) {
  if (!budget)
    return (
      <section className="panel workspace-empty">
        <h2>Financial data is unavailable</h2>
        <p>Reconnect and retry loading your account summary.</p>
      </section>
    );
  const configured = isBudgetConfigured(budget);
  const month = workspaceMonth(budget);
  const currentExpenses = monthlyExpenses(expenses, month);
  const recent = [...currentExpenses]
    .sort(
      (a, b) =>
        String(b.expense_date).localeCompare(String(a.expense_date)) ||
        b.id - a.id,
    )
    .slice(0, 5);
  const allowance = Number(budget?.allowance ?? 0);
  const spent = Number(budget?.total_spent ?? 0);
  const utilization = allowance > 0 ? (spent / allowance) * 100 : null;
  const byCategory = Object.entries(
    currentExpenses.reduce((totals, expense) => {
      totals[expense.category_name] =
        (totals[expense.category_name] || 0) + Number(expense.amount);
      return totals;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const recommendations =
    configured && currentExpenses.length
      ? (monthlyInsights?.recommendations || []).slice(0, 3)
      : [];
  return (
    <>
      <BudgetCards budget={budget} />
      {!configured && (
        <section className="workspace-onboarding">
          <span className="workspace-onboarding-icon">
            <WorkspaceIcon name="budget" size={28} />
          </span>
          <div>
            <span className="workspace-state">Budget not configured</span>
            <h2>Start with your first budget</h2>
            <p>
              {currentExpenses.length || categories.length
                ? "Your recorded activity is preserved. Set this month’s allowance and savings target to bring your plan together."
                : "Your workspace starts at zero. Set a monthly allowance and savings target, then add the categories that matter to you."}
            </p>
          </div>
          <button type="button" onClick={() => onNavigate("budget")}>
            Configure budget <WorkspaceIcon name="arrow" size={17} />
          </button>
        </section>
      )}
      <section className="workspace-quick-actions" aria-label="Quick actions">
        {[
          ["budget", "budget", configured ? "Manage budget" : "Set a budget"],
          ["add-expense", "expenses", "Record expense"],
          ["add-category", "categories", "Add category"],
          ["shopping-list", "shopping", "Plan shopping"],
        ].map(([id, icon, label]) => (
          <button type="button" key={id} onClick={() => onNavigate(id)}>
            <WorkspaceIcon name={icon} />
            <span>{label}</span>
            <WorkspaceIcon name="arrow" size={16} />
          </button>
        ))}
      </section>
      <div className="workspace-overview-grid">
        <section className="panel workspace-utilization">
          <div className="workspace-panel-heading">
            <h2>Budget utilization</h2>
            <span>{configured ? "This month" : "Not configured"}</span>
          </div>
          <strong>
            {utilization === null ? "—" : `${utilization.toFixed(1)}%`}
          </strong>
          <progress
            aria-label="Budget utilization"
            max="100"
            value={Math.min(100, Math.max(0, utilization ?? 0))}
          />
          <p>
            {!configured
              ? "Configure your allowance to measure budget usage."
              : allowance === 0
                ? spent > 0
                  ? "Spending exceeds your zero allowance."
                  : "You saved a zero budget. No allowance has been allocated."
                : utilization > 100
                  ? "Spending exceeds your allowance. Review your expenses and plan."
                  : `${money(spent)} spent of ${money(allowance)} allocated.`}
          </p>
          <div className="workspace-utilization-footer">
            <span>Planned expenditure</span>
            <strong>{money(budget?.total_planned ?? 0)}</strong>
          </div>
        </section>
        <section className="panel">
          <div className="workspace-panel-heading">
            <h2>Spending by category</h2>
            <span>
              {byCategory.length
                ? `${byCategory.length} ${byCategory.length === 1 ? "category" : "categories"}`
                : "This month"}
            </span>
          </div>
          {byCategory.length ? (
            <div className="workspace-breakdown">
              {byCategory.map(([name, amount]) => (
                <div key={name}>
                  <div>
                    <strong>{name}</strong>
                    <span>{money(amount)}</span>
                  </div>
                  <progress
                    max="100"
                    value={
                      spent > 0 ? Math.min(100, (amount / spent) * 100) : 0
                    }
                    aria-label={`${name} share of spending`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="workspace-empty">
              <WorkspaceIcon name="analytics" size={28} />
              <h3>No spending to break down yet</h3>
              <p>Your recorded expenses will appear here by category.</p>
            </div>
          )}
        </section>
        <section className="panel workspace-recent">
          <div className="workspace-panel-heading">
            <h2>Recent expenses</h2>
            <button
              className="workspace-text-button"
              type="button"
              onClick={() => onNavigate("recent-expenses")}
            >
              View history <WorkspaceIcon name="arrow" size={15} />
            </button>
          </div>
          {recent.length ? (
            <div className="workspace-recent-list">
              {recent.map((expense) => (
                <article key={expense.id}>
                  <span className="workspace-expense-icon">
                    <WorkspaceIcon name="expenses" size={18} />
                  </span>
                  <div>
                    <strong>{expense.item_name}</strong>
                    <span>
                      {expense.category_name} · {expense.expense_date}
                    </span>
                  </div>
                  <strong>{money(expense.amount)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="workspace-empty">
              <WorkspaceIcon name="expenses" size={28} />
              <h3>No expenses this month</h3>
              <p>
                When you record spending, your recent activity appears here.
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  onNavigate(categories.length ? "add-expense" : "add-category")
                }
              >
                {categories.length
                  ? "Record first expense"
                  : "Create first category"}
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="workspace-panel-heading">
            <h2>Financial insights</h2>
            <span>Rule-based</span>
          </div>
          {recommendations.length ? (
            <div className="workspace-insight-list">
              {recommendations.map((text, index) => (
                <p key={index}>{text}</p>
              ))}
              <button
                className="workspace-text-button"
                type="button"
                onClick={() => onNavigate("monthly-insights")}
              >
                Explore insights <WorkspaceIcon name="arrow" size={15} />
              </button>
            </div>
          ) : (
            <div className="workspace-empty">
              <WorkspaceIcon name="intelligence" size={28} />
              <h3>Insights need your financial activity</h3>
              <p>
                Set a budget and record spending to receive relevant monthly
                guidance.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
