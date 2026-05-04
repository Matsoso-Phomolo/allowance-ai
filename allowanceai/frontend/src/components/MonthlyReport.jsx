import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function money(value = 0) {
  return `R${Number(value).toFixed(2)}`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MonthlyReport({ report }) {
  if (!report) {
    return null;
  }

  const categoryChart = report.category_summary.map((category) => ({
    name: category.name,
    spent: category.spent_amount,
    planned: category.planned_amount,
  }));
  const expenseCategoryChart = report.category_summary.map((category) => ({
    name: category.name,
    amount: category.spent_amount,
  }));

  function exportExpenses() {
    downloadCsv("allowanceai-expenses.csv", [
      ["Item", "Category", "Amount", "Date"],
      ...report.top_expenses.map((expense) => [
        expense.item_name,
        expense.category_name,
        expense.amount,
        expense.expense_date,
      ]),
    ]);
  }

  function exportBudgetSummary() {
    downloadCsv("allowanceai-budget-summary.csv", [
      ["Allowance", report.allowance],
      ["Total Spent", report.total_spent],
      ["Remaining Money", report.remaining_money],
      ["Savings Target", report.savings_target],
      ["Risk Score", report.risk_score],
      ["Budget Health", report.budget_health],
      [],
      ["Category", "Planned", "Spent", "Remaining", "Status"],
      ...report.category_summary.map((category) => [
        category.name,
        category.planned_amount,
        category.spent_amount,
        category.remaining_amount,
        category.status,
      ]),
    ]);
  }

  return (
    <section className="panel monthly-report">
      <div className="panel-heading">
        <h2>Monthly Report</h2>
        <span className={`pill ${report.budget_health.toLowerCase()}`}>{report.budget_health}</span>
      </div>

      <div className="report-actions">
        <button className="secondary-button" type="button" onClick={() => window.print()}>
          Print Report
        </button>
        <button className="secondary-button" type="button" onClick={exportExpenses}>
          Export Expenses CSV
        </button>
        <button className="secondary-button" type="button" onClick={exportBudgetSummary}>
          Export Budget Summary CSV
        </button>
      </div>

      <div className="report-summary">
        <div>
          <span>Allowance</span>
          <strong>{money(report.allowance)}</strong>
        </div>
        <div>
          <span>Total Spent</span>
          <strong>{money(report.total_spent)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{money(report.remaining_money)}</strong>
        </div>
        <div>
          <span>Risk Score</span>
          <strong>{report.risk_score}/100</strong>
        </div>
      </div>

      <div className="report-verdict">
        <strong>AI Final Verdict</strong>
        <p>{report.final_verdict}</p>
        <span>{report.decision?.reasoning}</span>
      </div>

      <div className="report-block">
        <h3>Category Spending</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categoryChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="spent" fill="#1d4ed8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="report-block">
        <h3>Planned vs Spent</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={categoryChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="planned" fill="#94a3b8" />
            <Bar dataKey="spent" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="report-block">
        <h3>Expenses by Category</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={expenseCategoryChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="amount" fill="#eab308" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="report-grid">
        <div>
          <h3>Top Expenses</h3>
          <div className="mini-list">
            {report.top_expenses.length === 0 ? (
              <span>No expenses yet.</span>
            ) : (
              report.top_expenses.map((expense) => (
                <span key={expense.id}>
                  {expense.item_name} - {expense.category_name} - {money(expense.amount)}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <h3>Danger / Warning Categories</h3>
          <div className="mini-list">
            {report.overspending_categories.length === 0 ? (
              <span>No warning categories.</span>
            ) : (
              report.overspending_categories.map((category) => (
                <span key={category.id}>
                  {category.name} - {category.status} - {money(category.remaining_amount)} left
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="recommendation-list">
        {report.recommendations.map((recommendation, index) => (
          <p key={`${recommendation}-${index}`}>{recommendation}</p>
        ))}
      </div>
    </section>
  );
}
