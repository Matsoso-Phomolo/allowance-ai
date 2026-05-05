import AlertsPanel from "./AlertsPanel";
import BudgetCards from "./BudgetCards";
import BudgetForm from "./BudgetForm";
import BudgetIntelligence from "./BudgetIntelligence";
import CanIBuy from "./CanIBuy";
import CategoryForm from "./CategoryForm";
import CategoryList from "./CategoryList";
import ExpenseForm from "./ExpenseForm";
import ExpenseHistory from "./ExpenseHistory";
import MonthlyPlanner from "./MonthlyPlanner";
import MonthlyReport from "./MonthlyReport";
import ProfileSettings from "./ProfileSettings";
import ShoppingListEvaluator from "./ShoppingListEvaluator";
import SpendingTimetable from "./SpendingTimetable";

export default function Dashboard({
  alerts,
  budget,
  canIBuy,
  categories,
  createMonthlyPlan,
  evaluateList,
  expenses,
  intelligence,
  monthlyReport,
  onAddCategory,
  onDeleteCategory,
  onDeleteExpense,
  onAddExpense,
  onSaveBudget,
  onDeleteAccount,
  onExportData,
  onUpdatePassword,
  onUpdateProfile,
  onUpdateCategory,
  onUpdateExpense,
  timetable,
  user,
}) {
  return (
    <main className="dashboard">
      <BudgetCards budget={budget} />

      <section className="dashboard-grid">
        <div className="stack">
          <CategoryList
            categories={categories}
            onDeleteCategory={onDeleteCategory}
            onUpdateCategory={onUpdateCategory}
          />
          <ExpenseHistory
            categories={categories}
            expenses={expenses}
            onDeleteExpense={onDeleteExpense}
            onUpdateExpense={onUpdateExpense}
          />
          <MonthlyReport report={monthlyReport} />
        </div>

        <div className="stack">
          <BudgetForm budget={budget} onSaveBudget={onSaveBudget} />
          <ProfileSettings
            user={user}
            onDeleteAccount={onDeleteAccount}
            onExportData={onExportData}
            onUpdatePassword={onUpdatePassword}
            onUpdateProfile={onUpdateProfile}
          />
          <ExpenseForm categories={categories} onAddExpense={onAddExpense} />
          <CanIBuy categories={categories} onCheck={canIBuy} />
          <CategoryForm onAddCategory={onAddCategory} />
          <BudgetIntelligence intelligence={intelligence} />
          <SpendingTimetable timetable={timetable} />
          <ShoppingListEvaluator categories={categories} onEvaluate={evaluateList} />
          <MonthlyPlanner budget={budget} onCreatePlan={createMonthlyPlan} />
          <AlertsPanel alerts={alerts} />
        </div>
      </section>
    </main>
  );
}
