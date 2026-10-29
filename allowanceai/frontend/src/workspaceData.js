export function isBudgetConfigured(budget) {
  if (typeof budget?.configured === "boolean") return budget.configured;
  // Older APIs cannot distinguish a saved zero from absence. Never invent configuration.
  return Number(budget?.allowance) > 0;
}
export function workspaceMonth(budget) {
  if (budget?.month) return budget.month;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
export function monthlyExpenses(expenses, month) {
  return expenses.filter(
    (expense) => String(expense.expense_date).slice(0, 7) === month,
  );
}
