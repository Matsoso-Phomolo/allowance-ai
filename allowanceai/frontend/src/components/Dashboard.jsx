import { Link } from "react-router-dom";
import WorkspaceOverview from "./WorkspaceOverview";
import WorkspaceIcon from "./WorkspaceIcon";
import NotificationCenter from "./NotificationCenter";
import {
  isBudgetConfigured,
  monthlyExpenses,
  workspaceMonth,
} from "../workspaceData";
import { formatMoney as money } from "../currency";
import { useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";

import AlertsPanel from "./AlertsPanel";
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
  onDeleteShoppingList,
  onAddExpense,
  onSaveShoppingList,
  onSaveBudget,
  onDeleteAccount,
  onExportData,
  onUpdatePassword,
  onUpdateProfile,
  onUpdateCategory,
  onUpdateExpense,
  onUpdateShoppingList,
  savedShoppingLists,
  timetable,
  user,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
}) {
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const aliases = {
    dashboard: "overview",
    budgets: "budget",
    transactions: "recent-expenses",
    savings: "budget",
    shopping: "shopping-list",
    reports: "graphs",
    settings: "profile",
  };
  const routeSection = location.pathname.split("/")[2] || "overview";
  const activeSection = aliases[routeSection] || routeSection;
  const activeSectionRef = useRef(null);
  const drawerRef = useRef(null);
  const configured = isBudgetConfigured(budget);
  const hasActivity =
    monthlyExpenses(expenses, workspaceMonth(budget)).length > 0;
  useEffect(() => {
    if (!mobileNavigation) return;
    const modal = drawerRef.current,
      previous = document.activeElement;
    modal.showModal();
    return () => {
      modal.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [mobileNavigation]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (media.matches) setMobileNavigation(false);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
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
      content: (
        <ExpenseForm categories={categories} onAddExpense={onAddExpense} />
      ),
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
      content: (
        <AIRecommendations
          intelligence={intelligence}
          monthlyInsights={monthlyInsights}
        />
      ),
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
        <Suspense
          fallback={<SectionSkeleton title="Loading monthly insights" />}
        >
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
          <ShoppingListEvaluator
            categories={categories}
            onDeleteShoppingList={onDeleteShoppingList}
            onEvaluate={evaluateList}
            onSaveShoppingList={onSaveShoppingList}
            onUpdateShoppingList={onUpdateShoppingList}
            savedShoppingLists={savedShoppingLists}
          />
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

  dashboardSections.unshift(
    {
      id: "overview",
      title: "Overview",
      summary: "Your current month at a glance.",
      content: (
        <WorkspaceOverview
          budget={budget}
          categories={categories}
          expenses={expenses}
          monthlyInsights={monthlyInsights}
          onNavigate={handleSectionSelect}
        />
      ),
    },
    {
      id: "notifications",
      title: "Notifications",
      summary: "Updates from your account activity.",
      content: (
        <NotificationCenter
          inline
          notifications={notifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onDelete={onDeleteNotification}
        />
      ),
    },
    {
      id: "admin",
      title: "Administration",
      summary: "Authorized system overview.",
      content:
        user?.role === "admin" ? (
          <Suspense
            fallback={<SectionSkeleton title="Loading administration" />}
          >
            <AdminDashboard
              health={adminHealth}
              stats={adminStats}
              users={adminUsers}
            />
          </Suspense>
        ) : (
          <WorkspaceEmpty
            title="Access restricted"
            text="This section requires administrator authorization."
          />
        ),
    },
  );
  const validSection = dashboardSections.some(
    (section) => section.id === activeSection,
  );
  const selectedSection =
    dashboardSections.find((section) => section.id === activeSection) ||
    dashboardSections[0];
  const currentItem = WORKSPACE_GROUPS.flatMap((group) => group.items).find(
    (item) => item.sections.includes(selectedSection.id),
  );
  const tabs =
    currentItem?.sections.length > 1
      ? currentItem.sections.map((id) =>
          dashboardSections.find((section) => section.id === id),
        )
      : [];
  let content = selectedSection.content;
  if (
    !budget &&
    !["profile", "notifications", "admin"].includes(selectedSection.id)
  )
    content = (
      <WorkspaceEmpty
        title="Financial data is unavailable"
        text="The budget summary could not be loaded. Use Retry above before changing your financial plan."
      />
    );
  else if (
    ["graphs", "monthly-insights"].includes(selectedSection.id) &&
    (!hasActivity || !configured)
  )
    content = (
      <WorkspaceEmpty
        title={
          configured
            ? "No financial activity to analyze yet"
            : "Configure a budget to analyze this month"
        }
        text="Monthly analysis needs a configured budget and recorded spending. Your full history remains available in Expenses."
        action={configured ? "Record an expense" : "Configure budget"}
        onAction={() =>
          handleSectionSelect(
            configured
              ? categories.length
                ? "add-expense"
                : "add-category"
              : "budget",
          )
        }
      />
    );
  else if (
    [
      "budget-intelligence",
      "ai-recommendations",
      "category-survival",
      "alerts",
    ].includes(selectedSection.id) &&
    (!configured || !hasActivity)
  )
    content = (
      <WorkspaceEmpty
        title="Build your financial picture first"
        text="Budgeting intelligence needs a configured budget and recorded spending. No recommendations are shown in this empty view."
        action={configured ? "Record an expense" : "Configure budget"}
        onAction={() =>
          handleSectionSelect(
            configured
              ? categories.length
                ? "add-expense"
                : "add-category"
              : "budget",
          )
        }
      />
    );
  else if (
    selectedSection.id === "spending-timetable" &&
    (!configured || !categories.length)
  )
    content = (
      <WorkspaceEmpty
        title="Set up category limits first"
        text="Your timetable uses your own configured budget and category allocations."
        action="Manage categories"
        onAction={() => handleSectionSelect("categories")}
      />
    );
  else if (selectedSection.id === "add-expense" && !categories.length)
    content = (
      <WorkspaceEmpty
        title="Create a category for your first expense"
        text="Categories organize your spending. Add your own category and planned amount to get started."
        action="Create category"
        onAction={() => handleSectionSelect("add-category")}
      />
    );
  function handleSectionSelect(sectionId) {
    navigate(`/app/${sectionId}`);
    setMobileNavigation(false);
    window.requestAnimationFrame(() => {
      activeSectionRef.current?.focus({ preventScroll: true });
      activeSectionRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });
  }
  const navigation = (
    <WorkspaceNavigation
      active={selectedSection.id}
      user={user}
      notifications={notifications}
      onNavigate={handleSectionSelect}
    />
  );
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">{navigation}</aside>
      <button
        className="workspace-menu-toggle"
        type="button"
        aria-label="Workspace menu"
        aria-haspopup="dialog"
        aria-expanded={mobileNavigation}
        onClick={() => setMobileNavigation(true)}
      >
        <WorkspaceIcon name="menu" />
      </button>
      {mobileNavigation && (
        <dialog
          ref={drawerRef}
          className="workspace-drawer"
          aria-label="Workspace navigation"
          onCancel={(event) => {
            event.preventDefault();
            setMobileNavigation(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = Array.from(
              drawerRef.current.querySelectorAll("button,a[href]"),
            );
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <button
            className="workspace-drawer-close"
            type="button"
            aria-label="Close workspace menu"
            onClick={() => setMobileNavigation(false)}
            autoFocus
          >
            <WorkspaceIcon name="close" />
          </button>
          {navigation}
        </dialog>
      )}
      <main className="workspace-main">
        {!validSection && (
          <p role="status" className="notice">
            That section is unavailable. Your overview is shown below.
          </p>
        )}
        <header className="workspace-page-heading">
          <div>
            <p className="eyebrow">
              Personal finance / {workspaceMonth(budget)}
            </p>
            <h1 ref={activeSectionRef} tabIndex="-1">
              {selectedSection.title}
            </h1>
            <p>{selectedSection.summary}</p>
          </div>
          {selectedSection.id === "overview" && (
            <button
              type="button"
              onClick={() =>
                handleSectionSelect(
                  configured && categories.length ? "add-expense" : "budget",
                )
              }
            >
              <WorkspaceIcon name="plus" size={17} />
              {configured && categories.length
                ? "Add expense"
                : "Set up budget"}
            </button>
          )}
        </header>
        {tabs.length > 0 && (
          <nav
            className="workspace-section-tabs"
            aria-label={currentItem.label + " sections"}
          >
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                aria-current={
                  selectedSection.id === tab.id ? "page" : undefined
                }
                onClick={() => handleSectionSelect(tab.id)}
              >
                {tab.title}
              </button>
            ))}
          </nav>
        )}
        {content}
      </main>
    </div>
  );
}
const WORKSPACE_GROUPS = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", icon: "overview", sections: ["overview"] },
      { label: "Budget", icon: "budget", sections: ["budget"] },
      {
        label: "Categories",
        icon: "categories",
        sections: ["categories", "add-category"],
      },
      {
        label: "Expenses",
        icon: "expenses",
        sections: ["recent-expenses", "add-expense"],
      },
    ],
  },
  {
    title: "Plan & understand",
    items: [
      {
        label: "Savings & planning",
        icon: "planning",
        sections: ["monthly-planner", "spending-timetable", "can-i-buy"],
      },
      {
        label: "Shopping lists",
        icon: "shopping",
        sections: ["shopping-list"],
      },
      {
        label: "Analytics",
        icon: "analytics",
        sections: ["graphs", "monthly-insights"],
      },
      {
        label: "AI & intelligence",
        icon: "intelligence",
        sections: [
          "budget-intelligence",
          "ai-recommendations",
          "category-survival",
          "alerts",
        ],
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Notifications",
        icon: "notifications",
        sections: ["notifications"],
      },
      { label: "Profile & settings", icon: "profile", sections: ["profile"] },
      {
        label: "Administration",
        icon: "admin",
        sections: ["admin"],
        admin: true,
      },
    ],
  },
];
function WorkspaceNavigation({ active, user, notifications, onNavigate }) {
  const unread = notifications.filter((item) => !item.is_read).length;
  return (
    <>
      <Link
        className="workspace-brand"
        to="/app"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("overview");
        }}
      >
        <span className="workspace-brand-mark">
          a<span>i</span>
        </span>
        <span>
          AllowanceAI<small>PERSONAL FINANCE</small>
        </span>
      </Link>
      <nav aria-label="Financial workspace">
        {WORKSPACE_GROUPS.map((group) => (
          <section className="workspace-nav-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.items
              .filter((item) => !item.admin || user?.role === "admin")
              .map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-current={
                    item.sections.includes(active) ? "page" : undefined
                  }
                  onClick={() => onNavigate(item.sections[0])}
                >
                  <WorkspaceIcon name={item.icon} />
                  <span>{item.label}</span>
                  {item.icon === "notifications" && unread > 0 && (
                    <small className="workspace-nav-badge">{unread}</small>
                  )}
                </button>
              ))}
          </section>
        ))}
      </nav>
      <div className="workspace-sidebar-account">
        <span className="workspace-avatar">
          {user?.name?.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{user?.name}</strong>
          <small>Personal account</small>
        </div>
      </div>
    </>
  );
}
function WorkspaceEmpty({ title, text, action, onAction }) {
  return (
    <section className="panel workspace-empty workspace-section-empty">
      <WorkspaceIcon name="overview" size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </section>
  );
}

function AIRecommendations({ intelligence, monthlyInsights }) {
  const recommendations = [
    ...(monthlyInsights?.recommendations || []),
    ...(intelligence?.recommendations || []),
  ].filter(
    (recommendation, index, list) => list.indexOf(recommendation) === index,
  );

  return (
    <section className="panel intelligence-panel">
      <div className="panel-heading">
        <h2>AI Recommendations</h2>
        <span>
          {intelligence?.budget_health || monthlyInsights?.status || "SAFE"}
        </span>
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
                {category.priority} - {category.spending_pattern}, remaining{" "}
                {money(category.remaining_amount)}
              </span>
            </div>
            <span
              className={`pill ${String(category.survival_status).toLowerCase()}`}
            >
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
