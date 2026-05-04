const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://allowanceai-backend.onrender.com" : "http://127.0.0.1:8000");

let authToken = localStorage.getItem("allowanceai_token") || "";

export function setAuthToken(token) {
  authToken = token || "";
  if (authToken) {
    localStorage.setItem("allowanceai_token", authToken);
  } else {
    localStorage.removeItem("allowanceai_token");
  }
}

export function getAuthToken() {
  return authToken;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
}

export function registerUser(data) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function loginUser(data) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMe() {
  return request("/api/auth/me");
}

export function updateProfile(data) {
  return request("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function updatePassword(data) {
  return request("/api/auth/password", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getBudget() {
  return request("/api/budget");
}

export function createBudget(data) {
  return request("/api/budget", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getCategories() {
  return request("/api/categories");
}

export function createCategory(data) {
  return request("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCategory(id, data) {
  return request(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id) {
  return request(`/api/categories/${id}`, {
    method: "DELETE",
  });
}

export function getExpenses() {
  return request("/api/expenses");
}

export function addExpense(data) {
  return request("/api/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateExpense(id, data) {
  return request(`/api/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteExpense(id) {
  return request(`/api/expenses/${id}`, {
    method: "DELETE",
  });
}

export function getAlerts() {
  return request("/api/alerts");
}

export function getIntelligence() {
  return request("/api/intelligence");
}

export function getTimetable() {
  return request("/api/timetable");
}

export function getMonthlyReport() {
  return request("/api/reports/monthly");
}

export function createMonthlyPlan(data) {
  return request("/api/monthly-plan", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function evaluateList(data) {
  return request("/api/evaluate-list", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function canIBuy(data) {
  return request("/api/can-i-buy", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
