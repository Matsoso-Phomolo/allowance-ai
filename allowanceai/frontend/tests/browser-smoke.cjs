const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const page = await browser.newPage({ serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    let status = 200;
    if (path === "/api/auth/me")
      body = { name: "Test user", email: "test@example.invalid", role: "user" };
    else if (path === "/api/auth/login") {
      status = 401;
      body = { detail: "Invalid credentials" };
    } else if (path === "/api/budget")
      body = {
        allowance: 0,
        total_planned: 0,
        budget_status: "safe",
        configured: true,
        month: new Date().toISOString().slice(0, 7),
        total_spent: 0,
        remaining_money: 0,
        savings_target: 0,
      };
    else if (
      [
        "/api/categories",
        "/api/expenses",
        "/api/alerts",
        "/api/shopping-lists",
        "/api/notifications",
      ].includes(path)
    )
      body = [];
    else body = null;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/health", (r) => r.fulfill({ json: { status: "ok" } }));
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:5173/");
    await page.getByRole("heading", { name: /Take control/ }).waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw Error("Homepage overflow " + width);
    console.log("PASS homepage width", width);
  }
  for (const route of [
    "/features",
    "/how-it-works",
    "/about",
    "/help",
    "/privacy",
    "/terms",
    "/login",
    "/register",
  ]) {
    await page.goto("http://127.0.0.1:5173" + route);
    await page.locator("h1").waitFor();
    console.log("PASS direct route", route);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  if (!page.url().includes("/login")) throw Error("Mobile nav");
  await page.goto("http://127.0.0.1:5173/app/reports");
  await page.waitForURL("**/login?next=*");
  console.log("PASS protected route");
  await page.getByLabel("Email", { exact: true }).fill("test@example.invalid");
  await page.locator("input[type=password]").fill("incorrect");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Invalid email or password." })
    .waitFor();
  console.log("PASS invalid credentials");
  await page.goto("http://127.0.0.1:5173/login?next=https://evil.invalid");
  await page.evaluate(() =>
    localStorage.setItem("allowanceai_token", "test-only-token"),
  );
  await page.reload();
  await page.waitForURL("**/app");
  console.log("PASS safe redirect");
  await page.getByRole("button", { name: /Workspace menu/ }).click();
  await page
    .getByRole("navigation", { name: "Financial workspace" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  await page.waitForURL("**/app/recent-expenses");
  await page.reload();
  await page
    .getByRole("heading", { name: "Recent Expenses", exact: true })
    .first()
    .waitFor();
  console.log("PASS mobile workspace navigation and refresh");
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("heading", { name: /Take control/ }).waitFor();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: "Dashboard →", exact: true }).waitFor();
  console.log("PASS authenticated homepage");
  await page.goto("http://127.0.0.1:5173/app");
  const currency = page.getByLabel("Display currency", { exact: true });
  await currency.selectOption("LSL");
  await page
    .locator(".budget-cards")
    .getByText("M 0.00", { exact: true })
    .first()
    .waitFor();
  await page.reload();
  await page.getByLabel("Display currency", { exact: true }).waitFor();
  if (
    (await page
      .getByLabel("Display currency", { exact: true })
      .inputValue()) !== "LSL"
  )
    throw Error("Currency preference lost");
  await page
    .getByLabel("Display currency", { exact: true })
    .selectOption("ZAR");
  if (
    !(
      await page.locator(".budget-cards strong").first().innerText()
    ).startsWith("R")
  )
    throw Error("ZAR preference not restored");
  console.log("PASS LSL display, preference persistence and ZAR restoration");
  for (const [status, remaining, label] of [
    ["safe", 500, "Within budget"],
    ["warning", 100, "Approaching limit"],
    ["danger", -20, "Over budget"],
    ["danger", 20, "Budget at risk"],
  ]) {
    await page.route("**/api/budget", (route) =>
      route.fulfill({
        json: {
          allowance: 1000,
          total_planned: 800,
          total_spent: 1000 - remaining,
          remaining_money: remaining,
          savings_target: 100,
          budget_status: status,
        },
      }),
    );
    await page.reload();
    await page.getByText(label, { exact: true }).waitFor();
  }
  console.log("PASS textual budget states including overspending");
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("App overflow " + width);
  }
  console.log("PASS application widths");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:5173/");
  if (await page.evaluate(() => localStorage.getItem("allowanceai_token")))
    throw Error("Token not cleared");
  console.log("PASS logout");
  if (errors.length) throw Error(errors.join("\n"));
  console.log("PASS no browser runtime errors");
  await browser.close();
})();
