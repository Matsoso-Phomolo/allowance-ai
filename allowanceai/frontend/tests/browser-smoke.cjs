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
  await page.getByRole("button", { name: /^Recent Expenses/ }).click();
  await page.waitForURL("**/app/recent-expenses");
  await page.reload();
  await page.getByRole("heading", { name: "Recent Expenses", exact: true }).first().waitFor();
  console.log("PASS mobile workspace navigation and refresh");
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("heading", { name: /Take control/ }).waitFor();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: "Dashboard →", exact: true }).waitFor();
  console.log("PASS authenticated homepage");
  await page.goto("http://127.0.0.1:5173/app");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:5173/");
  if (await page.evaluate(() => localStorage.getItem("allowanceai_token")))
    throw Error("Token not cleared");
  console.log("PASS logout");
  if (errors.length) throw Error(errors.join("\n"));
  console.log("PASS no browser runtime errors");
  await browser.close();
})();
