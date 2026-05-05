import { useCallback, useEffect, useState } from "react";

import {
  addExpense,
  canIBuy,
  createBudget,
  createCategory,
  createMonthlyPlan,
  deleteCategory,
  deleteExpense,
  evaluateList,
  getAlerts,
  getBudget,
  getCategories,
  getExpenses,
  getIntelligence,
  getMonthlyReport,
  getTimetable,
  getAuthToken,
  getMe,
  loginUser,
  registerUser,
  setAuthToken,
  updateCategory,
  updateExpense,
  updatePassword,
  updateProfile,
} from "./api";
import Dashboard from "./components/Dashboard";
import InstallButton from "./components/InstallButton";
import Login from "./components/Login";
import Register from "./components/Register";

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";

export default function App() {
  const [budget, setBudget] = useState(null);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      const [budgetData, categoryData, expenseData, alertData, intelligenceData, timetableData, reportData] = await Promise.all([
        getBudget(),
        getCategories(),
        getExpenses(),
        getAlerts(),
        getIntelligence(),
        getTimetable(),
        getMonthlyReport(),
      ]);
      setBudget(budgetData);
      setCategories(categoryData);
      setExpenses(expenseData);
      setAlerts(alertData);
      setIntelligence(intelligenceData);
      setTimetable(timetableData);
      setMonthlyReport(reportData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!getAuthToken()) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        setUser(me);
      } catch {
        setAuthToken("");
      } finally {
        setAuthChecked(true);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const response = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const latestVersion = String(data.version || "").trim();
        if (!latestVersion || latestVersion === APP_VERSION || cancelled) {
          return;
        }

        if (!user) {
          const reloadKey = `allowanceai_reload_${latestVersion}`;
          if (!sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, "true");
            window.location.reload();
            return;
          }
        }

        setUpdateAvailable(true);
      } catch {
        // Version checks should never interrupt normal budgeting.
      }
    }

    checkForUpdate();
    const intervalId = window.setInterval(checkForUpdate, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      loadDashboard();
    }
  }, [user, loadDashboard]);

  async function handleLogin(credentials) {
    const response = await loginUser(credentials);
    setAuthToken(response.access_token);
    setUser(response.user);
  }

  async function handleRegister(data) {
    const response = await registerUser(data);
    setAuthToken(response.access_token);
    setUser(response.user);
  }

  function handleLogout() {
    setAuthToken("");
    setUser(null);
    setBudget(null);
    setCategories([]);
    setExpenses([]);
    setAlerts([]);
    setIntelligence(null);
    setMonthlyReport(null);
    setTimetable(null);
    setAuthMode("login");
  }

  async function handleAddExpense(expense) {
    const result = await addExpense(expense);
    await loadDashboard();
    return result;
  }

  async function handleUpdateExpense(id, expense) {
    const result = await updateExpense(id, expense);
    await loadDashboard();
    return result;
  }

  async function handleDeleteExpense(id) {
    await deleteExpense(id);
    await loadDashboard();
  }

  async function handleAddCategory(category) {
    await createCategory(category);
    await loadDashboard();
  }

  async function handleUpdateCategory(id, category) {
    await updateCategory(id, category);
    await loadDashboard();
  }

  async function handleDeleteCategory(id) {
    await deleteCategory(id);
    await loadDashboard();
  }

  async function handleSaveBudget(budgetData) {
    await createBudget(budgetData);
    await loadDashboard();
  }

  async function handleUpdateProfile(profile) {
    const updatedUser = await updateProfile(profile);
    setUser(updatedUser);
  }

  async function handleUpdatePassword(passwords) {
    await updatePassword(passwords);
  }

  if (!authChecked || loading && user) {
    return (
      <div className="app-shell">
        <main className="loading-panel">Loading dashboard...</main>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {updateAvailable && <UpdateBanner />}
        {authMode === "register" ? (
          <Register onRegister={handleRegister} onShowLogin={() => setAuthMode("login")} />
        ) : (
          <Login onLogin={handleLogin} onShowRegister={() => setAuthMode("register")} />
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      {updateAvailable && <UpdateBanner />}
      <header className="app-header">
        <div>
          <h1>AllowanceAI</h1>
        </div>
        <p className="header-summary">Monthly allowance, spending, savings, data, mokhatlo, and everyday budget control.</p>
        <div className="user-menu">
          <span>{user.name}</span>
          <InstallButton compact />
          <button className="logout-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {error && <div className="notice danger">{error}</div>}
      <Dashboard
          alerts={alerts}
          budget={budget}
          canIBuy={canIBuy}
          categories={categories}
          createMonthlyPlan={createMonthlyPlan}
          evaluateList={evaluateList}
          expenses={expenses}
          intelligence={intelligence}
          monthlyReport={monthlyReport}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          onDeleteExpense={handleDeleteExpense}
          onAddExpense={handleAddExpense}
          onSaveBudget={handleSaveBudget}
          onUpdateCategory={handleUpdateCategory}
          onUpdateExpense={handleUpdateExpense}
          onUpdatePassword={handleUpdatePassword}
          onUpdateProfile={handleUpdateProfile}
          timetable={timetable}
          user={user}
        />
      <footer className="app-footer">AllowanceAI | Produced by Matsoso P</footer>
    </div>
  );
}

function UpdateBanner() {
  return (
    <div className="update-banner">
      <span>New update available</span>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
