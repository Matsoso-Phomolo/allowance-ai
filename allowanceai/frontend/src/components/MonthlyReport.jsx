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

function pdfEscape(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapText(text, maxLength = 88) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function createPdfBlob(title, lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const lineHeight = 16;
  const contentHeight = pageHeight - margin * 2;
  const linesPerPage = Math.floor(contentHeight / lineHeight);
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects = [];

  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageObjectIds = [];

  pages.forEach((pageLines, pageIndex) => {
    const text = [
      "BT",
      "/F1 11 Tf",
      `1 0 0 1 ${margin} ${pageHeight - margin} Tm`,
      "16 TL",
      pageIndex === 0 ? `/F1 18 Tf (${pdfEscape(title)}) Tj` : `/F1 11 Tf (${pdfEscape(title)} continued) Tj`,
      "T*",
      "/F1 11 Tf",
      ...pageLines.map((line) => `(${pdfEscape(line)}) Tj T*`),
      "ET",
    ].join("\n");
    const streamObjectId = addObject(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    const pageObjectId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${streamObjectId} 0 R >>`
    );
    pageObjectIds.push(pageObjectId);
  });

  const pagesObjectId = addObject(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  pageObjectIds.forEach((pageObjectId) => {
    objects[pageObjectId - 1] = objects[pageObjectId - 1].replace("/Parent 0 0 R", `/Parent ${pagesObjectId} 0 R`);
  });
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadPdf(filename, title, lines) {
  const blob = createPdfBlob(title, lines);
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

  function exportReportPdf() {
    const lines = [
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Monthly Summary",
      `Allowance: ${money(report.allowance)}`,
      `Total spent: ${money(report.total_spent)}`,
      `Remaining money: ${money(report.remaining_money)}`,
      `Savings target: ${money(report.savings_target)}`,
      `Risk score: ${report.risk_score}/100`,
      `Budget health: ${report.budget_health}`,
      "",
      "AI Final Verdict",
      ...wrapText(report.final_verdict),
      ...(report.decision?.reasoning ? wrapText(report.decision.reasoning) : []),
      "",
      "Category Breakdown",
      ...report.category_summary.flatMap((category) =>
        wrapText(
          `${category.name}: planned ${money(category.planned_amount)}, spent ${money(category.spent_amount)}, remaining ${money(category.remaining_amount)}, status ${category.status}.`
        )
      ),
      "",
      "Top Expenses",
      ...(report.top_expenses.length
        ? report.top_expenses.flatMap((expense) =>
            wrapText(`${expense.item_name} - ${expense.category_name} - ${money(expense.amount)} - ${expense.expense_date}`)
          )
        : ["No expenses yet."]),
      "",
      "Danger / Warning Categories",
      ...(report.overspending_categories.length
        ? report.overspending_categories.flatMap((category) =>
            wrapText(`${category.name} - ${category.status} - ${money(category.remaining_amount)} left`)
          )
        : ["No warning categories."]),
      "",
      "AI Recommendations",
      ...report.recommendations.flatMap((recommendation) => wrapText(`- ${recommendation}`)),
    ];

    downloadPdf("allowanceai-monthly-report.pdf", "AllowanceAI Monthly Report", lines);
  }

  return (
    <section className="panel monthly-report">
      <div className="panel-heading">
        <h2>Monthly Report</h2>
        <span className={`pill ${report.budget_health.toLowerCase()}`}>{report.budget_health}</span>
      </div>

      <div className="report-actions">
        <button className="secondary-button" type="button" onClick={exportReportPdf}>
          Print Report PDF
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
