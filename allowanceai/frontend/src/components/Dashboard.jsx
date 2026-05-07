import { Suspense, lazy, useRef, useState } from "react";

import AlertsPanel from "./AlertsPanel";
import BudgetCards from "./BudgetCards";
import BudgetForm from "./BudgetForm";
import BudgetIntelligence from "./BudgetIntelligence";
import CanIBuy from "./CanIBuy";
import CategoryForm from "./CategoryForm";
import CategoryList from "./CategoryList";
import ExpenseForm from "./ExpenseForm";
import ExpenseHistory from "./ExpenseHistory";
import ProfileSettings from "./ProfileSettings";

const AdminDashboard = lazy(() => import("./AdminDashboard"));
const MonthlyInsights = lazy(() => import("./MonthlyInsights"));
const MonthlyPlanner = lazy(() => import("./MonthlyPlanner"));
const MonthlyReport = lazy(() => import("./MonthlyReport"));
const ShoppingListEvaluator = lazy(() => import("./ShoppingListEvaluator"));
const SpendingTimetable = lazy(() => import("./SpendingTimetable"));

export default function Dashboard({
  alerts,
  adminHealth,
  adminStats,
  adminUsers,
  budget,
  canIBuy,
  categories,
  createMonthlyPlan,
  evaluateList,
  expenses,
  intelligence,
  monthlyReport,
  monthlyInsights,
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
  const [activeSection, setActiveSection] = useState("budget");
  const activeSectionRef = useRef(null);
  const dashboardSections = [
    {
      id: "budget",
      title: "Budget",
      summary: "Set allowance and savings target.",
      content: <BudgetForm budget={budget} onSaveBudget={onSaveBudget} />,
    },
    {
      id: "categories",
      title: "Budget Category",
      summary: "View and edit planned category amounts.",
      content: (
        <CategoryList
          categories={categories}
          onDeleteCategory={onDeleteCategory}
          onUpdateCategory={onUpdateCategory}
        />
      ),
    },
    {
      id: "recent-expenses",
      title: "Recent Expenses",
      summary: "Review, edit, or remove spending.",
      content: (
        <ExpenseHistory
          categories={categories}
          expenses={expenses}
          onDeleteExpense={onDeleteExpense}
          onUpdateExpense={onUpdateExpense}
        />
      ),
    },
    {
      id: "add-expense",
      title: "Add Expense",
      summary: "Record new spending.",
      content: <ExpenseForm categories={categories} onAddExpense={onAddExpense} />,
    },
    {
      id: "add-category",
      title: "Add Category",
      summary: "Create another budget category.",
      content: <CategoryForm onAddCategory={onAddCategory} />,
    },
    {
      id: "graphs",
      title: "Graphs",
      summary: "Charts, top expenses, and monthly report.",
      content: (
        <Suspense fallback={<SectionSkeleton title="Loading monthly report" />}>
          <MonthlyReport report={monthlyReport} />
        </Suspense>
      ),
    },
    {
      id: "spending-timetable",
      title: "Spending Timetable",
      summary: "Weekly food and snacks limits.",
      content: (
        <Suspense fallback={<SectionSkeleton title="Loading timetable" />}>
          <SpendingTimetable timetable={timetable} />
        </Suspense>
      ),
    },
    {
      id: "monthly-planner",
      title: "Monthly Planner",
      summary: "Generate a suggested monthly split.",
      content: (
        <Suspense fallback={<SectionSkeleton title="Loading planner" />}>
          <MonthlyPlanner budget={budget} onCreatePlan={createMonthlyPlan} />
        </Suspense>
      ),
    },
    {
      id: "category-survival",
      title: "Category Survival",
      summary: "See which categories can last.",
      content: <CategorySurvival intelligence={intelligence} />,
    },
    {
      id: "ai-recommendations",
      title: "AI Recommendations",
      summary: "Rule-based advice for this month.",
      content: <AIRecommendations intelligence={intelligence} monthlyInsights={monthlyInsights} />,
    },
    {
      id: "budget-intelligence",
      title: "Budget Intelligence",
      summary: "Risk score, projection, and full analysis.",
      content: <BudgetIntelligence intelligence={intelligence} />,
    },
    {
      id: "monthly-insights",
      title: "Monthly Insights",
      summary: "Behavior patterns and changes this month.",
      content: (
        <Suspense fallback={<SectionSkeleton title="Loading monthly insights" />}>
          <MonthlyInsights insights={monthlyInsights} />
        </Suspense>
      ),
    },
    {
      id: "can-i-buy",
      title: "Can I Buy",
      summary: "Check a purchase before spending.",
      content: <CanIBuy categories={categories} onCheck={canIBuy} />,
    },
    {
      id: "shopping-list",
      title: "Shopping List",
      summary: "Check several purchases at once.",
      content: (
        <Suspense fallback={<SectionSkeleton title="Loading evaluator" />}>
          <ShoppingListEvaluator categories={categories} onEvaluate={evaluateList} />
        </Suspense>
      ),
    },
    {
      id: "alerts",
      title: "Alerts",
      summary: "Warnings and safe spending signals.",
      content: <AlertsPanel alerts={alerts} />,
    },
    {
      id: "profile",
      title: "Profile",
      summary: "Account, password, and export tools.",
      content: (
        <ProfileSettings
          user={user}
          onDeleteAccount={onDeleteAccount}
          onExportData={onExportData}
          onUpdatePassword={onUpdatePassword}
          onUpdateProfile={onUpdateProfile}
        />
      ),
    },
  ];
  const selectedSection = dashboardSections.find((section) => section.id === activeSection) || dashboardSections[0];

  function handleSectionSelect(sectionId) {
    setActiveSection(sectionId);
    window.requestAnimationFrame(() => {
      activeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="dashboard">
      <BudgetCards budget={budget} />
      {user?.role === "admin" && (
        <Suspense fallback={<SectionSkeleton title="Loading admin dashboard" />}>
          <AdminDashboard health={adminHealth} stats={adminStats} users={adminUsers} />
        </Suspense>
      )}

      <section className="dashboard-navigator" aria-label="Dashboard sections">
        {dashboardSections.map((section) => (
          <button
            className={`dashboard-nav-button ${section.id === selectedSection.id ? "active" : ""}`}
            key={section.id}
            type="button"
            onClick={() => handleSectionSelect(section.id)}
          >
            <strong>{section.title}</strong>
            <span>{section.summary}</span>
          </button>
        ))}
      </section>

      <section className="active-dashboard-section" aria-live="polite" ref={activeSectionRef}>
        <div className="active-section-heading">
          <div>
            <p className="eyebrow">Selected section</p>
            <h2>{selectedSection.title}</h2>
          </div>
        </div>
        {selectedSection.content}
      </section>
    </main>
  );
}

function AIRecommendations({ intelligence, monthlyInsights }) {
  const recommendations = [
    ...(monthlyInsights?.recommendations || []),
    ...(intelligence?.recommendations || []),
  ].filter((recommendation, index, list) => list.indexOf(recommendation) === index);

  return (
    <section className="panel intelligence-panel">
      <div className="panel-heading">
        <h2>AI Recommendations</h2>
        <span>{intelligence?.budget_health || monthlyInsights?.status || "SAFE"}</span>
      </div>
      <div className="recommendation-list">
        {recommendations.length ? (
          recommendations.map((recommendation, index) => (
            <p key={`${recommendation}-${index}`}>{recommendation}</p>
          ))
        ) : (
          <p>No recommendations yet.</p>
        )}
      </div>
    </section>
  );
}

function CategorySurvival({ intelligence }) {
  if (!intelligence) {
    return (
      <section className="panel">
        <h2>Category Survival</h2>
        <p>No category survival data yet.</p>
      </section>
    );
  }

  return (
    <section className="panel intelligence-panel">
      <div className="panel-heading">
        <h2>Category Survival</h2>
        <span>{intelligence.budget_health}</span>
      </div>
      <div className="category-survival-list">
        {intelligence.category_predictions.map((category) => (
          <article className="survival-row" key={category.name}>
            <div>
              <strong>{category.name}</strong>
              <span>
                {category.priority} - {category.spending_pattern}, remaining R
                {Number(category.remaining_amount).toFixed(2)}
              </span>
            </div>
            <span className={`pill ${String(category.survival_status).toLowerCase()}`}>
              {category.survival_status} {category.risk_score}/100
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionSkeleton({ title }) {
  return (
    <section className="panel section-skeleton" aria-label={title}>
      <div />
      <div />
      <div />
    </section>
  );
}
