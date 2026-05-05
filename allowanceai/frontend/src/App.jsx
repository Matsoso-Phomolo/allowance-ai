import { useCallback, useEffect, useState } from "react";

import {
  addExpense,
  canIBuy,
  createBudget,
  createCategory,
  createMonthlyPlan,
  deleteCategory,
  deleteExpense,
  deleteMyAccount,
  evaluateList,
  exportMyData,
  getAdminHealth,
  getAdminStats,
  getAdminUsers,
  getAlerts,
  getBackendHealth,
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

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.4";

export default function App() {
  const [budget, setBudget] = useState(null);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState("");
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminHealth, setAdminHealth] = useState(null);
  const [backendReachable, setBackendReachable] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);

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

  const loadAdminDashboard = useCallback(async () => {
    if ((user?.role || "user") !== "admin") {
      setAdminStats(null);
      setAdminUsers([]);
      setAdminHealth(null);
      return;
    }

    try {
      const [statsData, usersData, healthData] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminHealth(),
      ]);
      setAdminStats(statsData);
      setAdminUsers(usersData);
      setAdminHealth(healthData);
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

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

    async function checkBackend() {
      try {
        await getBackendHealth();
        if (!cancelled) {
          setBackendReachable(true);
        }
      } catch {
        if (!cancelled) {
          setBackendReachable(false);
        }
      }
    }

    checkBackend();
    const intervalId = window.setInterval(checkBackend, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
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
    function updateOnlineState() {
      setIsOnline(window.navigator.onLine);
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setLoading(true);
      loadDashboard();
    }
  }, [user, loadDashboard]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadAdminDashboard();
    }
  }, [user, loadAdminDashboard]);

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
    setAdminStats(null);
    setAdminUsers([]);
    setAdminHealth(null);
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

  async function handleExportData() {
    const data = await exportMyData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `allowanceai-data-${user.email}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount() {
    await deleteMyAccount();
    handleLogout();
  }

  if (!authChecked || loading && user) {
    return (
      <SplashScreen />
    );
  }

  if (!user) {
    return (
      authMode === "register" ? (
        <Register
          onRegister={handleRegister}
          onShowLogin={() => setAuthMode("login")}
          offlineNotice={!isOnline ? <OfflineBanner /> : null}
          updateNotice={updateAvailable ? <UpdateBanner /> : null}
        />
      ) : (
        <Login
          onLogin={handleLogin}
          onShowRegister={() => setAuthMode("register")}
          offlineNotice={!isOnline ? <OfflineBanner /> : null}
          updateNotice={updateAvailable ? <UpdateBanner /> : null}
        />
      )
    );
  }

  return (
    <div className="app-shell">
      {updateAvailable && <UpdateBanner />}
      {!isOnline && <OfflineBanner />}
      <header className="app-header">
        <div>
          <h1>AllowanceAI</h1>
        </div>
        <p className="header-summary">Monthly allowance, spending, savings, data, mokhatlo, and everyday budget control.</p>
        <div className="user-menu">
          <span>{user.name}</span>
          <span className={`backend-status ${backendReachable ? "online" : "offline"}`}>
            {backendReachable ? "Backend online" : "Backend offline"}
          </span>
          <InstallButton compact />
          <button className="logout-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {error && <div className="notice danger">{error}</div>}
      <Dashboard
          alerts={alerts}
          adminHealth={adminHealth}
          adminStats={adminStats}
          adminUsers={adminUsers}
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
          onExportData={handleExportData}
          onDeleteAccount={handleDeleteAccount}
          timetable={timetable}
          user={user}
        />
      <footer className="app-footer">AllowanceAI | Produced by Matsoso P</footer>
    </div>
  );
}

function SplashScreen() {
  return (
    <main className="splash-screen">
      <section className="splash-card">
        <div className="splash-logo">AI</div>
        <h1>AllowanceAI</h1>
        <p>Preparing your budget dashboard...</p>
      </section>
    </main>
  );
}

function OfflineBanner() {
  return (
    <div className="offline-banner">
      You are offline. Some features may be unavailable.
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
