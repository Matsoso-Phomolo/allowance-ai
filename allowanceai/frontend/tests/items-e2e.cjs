const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const ROOT = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8001";
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(ROOT + "/register");
  await page.getByLabel("Name", { exact: true }).fill("Item workflow tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`item-workflow-${Date.now()}@example.invalid`);
  await page.locator("input[type=password]").fill("isolated-item-test-42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app");
  await page.goto(ROOT + "/app/monthly-planner");
  await page
    .getByRole("heading", { name: "Monthly Planner", exact: true })
    .first()
    .waitFor();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Monthly essentials");
  await page.getByLabel("Available allowance", { exact: true }).fill("1000");
  await page.getByLabel("Reserved savings", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Create item workspace", exact: true })
    .click();
  const entry = page.getByRole("form", { name: "Item entry" });
  await entry.getByLabel("Item name", { exact: true }).fill("Rice");
  await entry.getByLabel("Product description", { exact: true }).focus();
  await page.getByText(/Suggestion: Groceries/).waitFor();
  await entry.getByLabel("Package size", { exact: true }).fill("2.5");
  await entry.getByLabel("Measurement unit").selectOption("kg");
  await entry.getByLabel("Package type").selectOption("bag");
  await entry
    .getByLabel("Planned purchase quantity", { exact: true })
    .fill("3");
  await entry
    .getByLabel("Estimated price per purchasable unit", { exact: true })
    .fill("30");
  await entry.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByText("Item saved. Its estimate is separate from actual spending.")
    .waitFor();
  assert.match(
    await page.locator(".item-summary").first().innerText(),
    /90.00/,
  );
  await page.reload();
  await page
    .getByLabel("Open saved plan")
    .selectOption(
      await page
        .getByLabel("Open saved plan")
        .locator("option")
        .filter({ hasText: "Monthly essentials" })
        .getAttribute("value"),
    );
  await page
    .getByRole("checkbox", { name: "Select Rice for purchase" })
    .waitFor();
  await page
    .getByText("Apply allocations to my budget", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply proposed allocations" })
    .click();
  await page
    .getByText(
      /Budget saved for this month only. Included category allocations/,
    )
    .waitFor();
  await page
    .getByRole("checkbox", { name: "Select Rice for purchase" })
    .check();
  await page.getByLabel("Purchased quantity", { exact: true }).fill("2");
  await page.getByLabel("Actual unit price", { exact: true }).fill("32.10");
  assert.deepEqual(
    await page.locator(".item-purchase input:invalid").evaluateAll((rows) =>
      rows.map((row) => ({
        value: row.value,
        message: row.validationMessage,
      })),
    ),
    [],
  );
  var previewResponse = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/purchase-preview")),
    page.getByRole("button", { name: "Review actual total" }).click(),
  ]);
  assert.equal(
    previewResponse[0].status(),
    200,
    await previewResponse[0].text(),
  );
  await page
    .getByRole("heading", { name: "Confirm actual purchase" })
    .waitFor();
  assert.match(await page.locator(".item-confirmation").innerText(), /64.20/);
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await page
    .getByText(
      "Purchase confirmed. Only purchased quantities were recorded as expenses.",
    )
    .waitFor();
  assert.match(await page.locator(".item-row").first().innerText(), /partial/);
  assert.match(await page.locator(".item-row").first().innerText(), /1.000/);
  const token = await page.evaluate(() =>
    localStorage.getItem("allowanceai_token"),
  );
  // Read real local records only; all writes below target the disposable local API.
  const stored = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  const authToken =
    token || Object.entries(stored).find(([key]) => /token/i.test(key))?.[1];
  assert.ok(authToken, "authentication token found");
  const headers = { Authorization: `Bearer ${authToken}` };
  async function api(method, route, data) {
    const r = await context.request.fetch(API + route, {
      method,
      headers,
      data,
    });
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  let expenses = await api("GET", "/api/expenses");
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amount, "64.2000000000");
  assert.ok(expenses[0].purchase_event_id);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      `overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({
    path: path.resolve("../docs/items-monthly-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({
    path: path.resolve("../docs/items-monthly-mobile.png"),
    fullPage: true,
  });
  console.log(
    "PASS real monthly item entry, automatic categorization, save/reopen, explicit budget application, partial confirmation and five responsive widths",
  );
  await page.goto(ROOT + "/app/recent-expenses");
  await page.getByText(/Confirmed purchase #/).waitFor();
  await page.goto(ROOT + "/app/graphs");
  await page
    .getByLabel("Compare saved plan")
    .selectOption(
      await page
        .getByLabel("Compare saved plan")
        .locator("option")
        .filter({ hasText: "Monthly essentials" })
        .getAttribute("value"),
    );
  await page.getByText("Actual linked purchases", { exact: true }).waitFor();
  console.log("PASS read-only linked expense and plan/actual analytics");
  let shopping = await api("POST", "/api/plans", {
    kind: "shopping",
    name: "100-item purchase test",
    month: new Date().toISOString().slice(0, 7),
    allowance: "5000",
    reserved_savings: "0",
  });
  shopping = await api("POST", `/api/plans/${shopping.id}/items`, {
    version: shopping.version,
    items: Array.from({ length: 100 }, (_, i) => ({
      item_name: `Rice ${i + 1}`,
      quantity: "1",
      estimated_unit_price: "10",
      package_size: "1",
      measurement_unit: "kg",
      package_type: "bag",
    })),
  });
  await page.goto(ROOT + "/app/shopping-list");
  await page.getByLabel("Open saved list").selectOption(String(shopping.id));
  assert.equal(await page.locator(".item-row").count(), 100);
  const checks = page.getByRole("checkbox");
  for (let i = 0; i < 65; i++) await checks.nth(i).check();
  assert.deepEqual(
    await page.locator(".item-purchase input:invalid").evaluateAll((rows) =>
      rows.map((row) => ({
        value: row.value,
        message: row.validationMessage,
      })),
    ),
    [],
  );
  var previewResponse = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/purchase-preview")),
    page.getByRole("button", { name: "Review actual total" }).click(),
  ]);
  assert.equal(
    previewResponse[0].status(),
    200,
    await previewResponse[0].text(),
  );
  await page
    .getByRole("heading", { name: "Confirm actual purchase" })
    .waitFor();
  assert.match(await page.locator(".item-confirmation").innerText(), /650.00/);
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await page
    .getByText(
      "Purchase confirmed. Only purchased quantities were recorded as expenses.",
    )
    .waitFor();
  shopping = await api("GET", `/api/plans/${shopping.id}`);
  assert.equal(
    shopping.items.filter((item) => item.status === "pending").length,
    35,
  );
  assert.equal(
    shopping.items.filter((item) => item.status === "purchased").length,
    65,
  );
  expenses = await api("GET", "/api/expenses");
  assert.equal(expenses.length, 66);
  await page.reload();
  await page.getByLabel("Open saved list").selectOption(String(shopping.id));
  assert.equal(
    await page.locator(".item-status").filter({ hasText: "purchased" }).count(),
    65,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS real 100-item shopping list: UI selects/confirms 65, preserves 35 pending, creates exactly 65 additional expenses and persists after refresh",
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
