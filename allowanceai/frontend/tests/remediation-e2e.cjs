const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
  });
  const API = "http://127.0.0.1:8001",
    ROOT = "http://127.0.0.1:5173";
  const auth = await context.request.post(API + "/api/auth/register", {
    data: {
      name: "Remediation workflow",
      email: `remediation-${Date.now()}@example.invalid`,
      password: "local-regression-42",
    },
  });
  assert.equal(auth.status(), 200);
  const account = await auth.json(),
    headers = { Authorization: `Bearer ${account.access_token}` };
  async function api(method, path, data) {
    const r = await context.request.fetch(API + path, {
      method,
      headers,
      data,
    });
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  let monthly = await api("POST", "/api/plans", {
    kind: "monthly",
    name: "Monthly rice",
    month: "2026-10",
    allowance: "1000",
    reserved_savings: "100",
  });
  monthly = await api("POST", `/api/plans/${monthly.id}/items`, {
    version: monthly.version,
    items: [
      {
        item_name: "Rice",
        package_size: "2.5",
        measurement_unit: "kg",
        package_type: "bag",
        quantity: "3",
        estimated_unit_price: "30",
      },
    ],
  });
  const shopping = await api("POST", "/api/plans", {
    kind: "shopping",
    name: "Independent shopping",
    month: "2026-10",
    allowance: "200",
    reserved_savings: "0",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(ROOT);
  await page.evaluate(
    (token) => localStorage.setItem("allowanceai_token", token),
    account.access_token,
  );
  await page.goto(ROOT + "/app/monthly-planner");
  await page.getByLabel("Open saved plan").selectOption(String(monthly.id));
  await page
    .getByRole("checkbox", { name: "Select Rice for purchase" })
    .check();
  await page
    .getByRole("navigation", { name: "Financial workspace" })
    .getByRole("button", { name: "Shopping lists", exact: true })
    .click();
  await page
    .getByLabel("Open saved list")
    .locator("option")
    .filter({ hasText: "Independent shopping" })
    .waitFor({ state: "attached" });
  assert.equal(
    await page.getByLabel("List name", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Select Rice for purchase" })
      .count(),
    0,
  );
  await page.getByLabel("Open saved list").selectOption(String(shopping.id));
  assert.equal(
    await page.getByLabel("List name", { exact: true }).inputValue(),
    "Independent shopping",
  );
  await page
    .getByRole("navigation", { name: "Financial workspace" })
    .getByRole("button", { name: "Savings & planning", exact: true })
    .click();
  await page.getByLabel("Open saved plan").selectOption(String(monthly.id));
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Select Rice for purchase" })
      .isChecked(),
    false,
  );
  await page.goBack();
  await page.getByLabel("Open saved list").waitFor();
  await page.goForward();
  await page.getByLabel("Open saved plan").selectOption(String(monthly.id));
  await page.reload();
  await page.getByLabel("Open saved plan").selectOption(String(monthly.id));
  console.log(
    "PASS direct monthly/shopping navigation, back/forward, deep-link refresh and no retained selection",
  );
  await page
    .getByRole("checkbox", { name: "Select Rice for purchase" })
    .check();
  await page.getByLabel("Purchased quantity", { exact: true }).fill("1");
  await page.getByLabel("Actual unit price", { exact: true }).fill("32.10");
  await page.getByRole("button", { name: "Review actual total" }).click();
  await page
    .getByRole("heading", { name: "Confirm actual purchase" })
    .waitFor();
  const purchaseURL = `**/api/plans/${monthly.id}/purchases`;
  let dropped = false;
  await page.route(purchaseURL, async (route) => {
    if (dropped) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    dropped = true;
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Could not connect" })
    .waitFor();
  assert.equal((await api("GET", "/api/expenses")).length, 1);
  await page.reload();
  await page
    .getByRole("heading", { name: "Confirm actual purchase" })
    .waitFor();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await page
    .getByText(
      "Purchase confirmed. Only purchased quantities were recorded as expenses.",
    )
    .waitFor();
  const expenses = await api("GET", "/api/expenses");
  assert.equal(expenses.length, 1);
  assert.equal(Number(expenses[0].amount), 32.1);
  monthly = await api("GET", `/api/plans/${monthly.id}`);
  assert.equal(monthly.items[0].remaining_quantity, "2.000");
  assert.equal(monthly.purchases.length, 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS real commit/lost-response/reload/retry: same saved key, one expense/event, two pending bags",
  );
  await page.goto(ROOT + "/app/add-expense");
  await page.getByLabel("Item", { exact: true }).fill("Manual uncertain response");
  await page.getByLabel("Amount", { exact: true }).fill("5.50");
  let manualDropped = false;
  await page.route("**/api/expenses", async route => {
    if (route.request().method() !== "POST" || manualDropped) { await route.continue(); return; }
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    manualDropped = true;
    await route.abort("failed");
  });
  await page.getByRole("button", {name: "Add Spending", exact: true}).click();
  await page.getByRole("alert").filter({hasText: "Could not connect"}).waitFor();
  assert.equal((await api("GET", "/api/expenses")).length, 2);
  await page.reload();
  await page.getByText(/A prior expense request may have completed/).waitFor();
  await page.getByRole("button", {name: "Add Spending", exact: true}).click();
  await page.getByText(/Expense saved|over budget|planned budget/).first().waitFor();
  assert.equal((await api("GET", "/api/expenses")).length, 2);
  assert.deepEqual(errors, []);
  console.log("PASS manual expense commit/lost-response/reload/retry: one manual expense, preserved operation key");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
