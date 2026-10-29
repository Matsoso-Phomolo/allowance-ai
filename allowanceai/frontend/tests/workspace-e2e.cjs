const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const root = process.env.WORKSPACE_TEST_URL || "http://127.0.0.1:5173";
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const suffix = Date.now();
  const alice = `workspace-alice-${suffix}@example.invalid`,
    bob = `workspace-bob-${suffix}@example.invalid`;
  async function register(email, name) {
    if (page.url() === root + "/") {
      if (
        await page
          .getByRole("button", { name: "Menu", exact: true })
          .isVisible()
      )
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.locator('.public-nav a[href="/register"]').click();
    } else {
      await page.goto(root + "/register");
    }
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input[type=password]").fill("regression-password-42");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page.waitForURL("**/app");
    await page
      .getByRole("heading", { name: "Overview", exact: true })
      .waitFor();
  }
  async function navigate(label) {
    if (
      await page
        .getByRole("button", { name: "Workspace menu", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Workspace menu", exact: true })
        .click();
    await page
      .getByRole("navigation", { name: "Financial workspace" })
      .getByRole("button", { name: label, exact: true })
      .click();
  }
  function amount(label) {
    return page
      .locator(".budget-cards article")
      .filter({
        has: page.locator("span", { hasText: new RegExp("^" + label + "$") }),
      })
      .locator("strong");
  }
  async function screenshot(name) {
    await page.screenshot({
      path: require("node:path").join(__dirname, "../../docs/" + name),
      fullPage: true,
    });
  }
  await register(alice, "Workspace QA");
  await page
    .getByRole("heading", { name: "Start with your first budget", exact: true })
    .waitFor();
  const shell = page.locator(".workspace-shell");
  assert.equal(
    await shell.getByRole("link", { name: "Home", exact: true }).count(),
    0,
  );
  assert.equal(
    await shell.getByRole("link", { name: "Help", exact: true }).count(),
    0,
  );
  for (const label of [
    "Monthly budget",
    "Actual expenditure",
    "Remaining budget",
    "Savings goal",
    "Planned expenditure",
  ])
    assert.match(await amount(label).innerText(), /0[,.]00/);
  assert.equal(await page.locator(".recharts-wrapper").count(), 0);
  await screenshot("workspace-empty-desktop.png");
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Empty overflow " + width,
    );
  }
  console.log(
    "PASS real registration, zero metrics, onboarding and responsive empty state",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Configure budget", exact: true })
    .click();
  await page.getByLabel("Allowance", { exact: true }).fill("1000.50");
  await page.getByLabel("Savings Target", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Save Budget", exact: true }).click();
  await page.getByText(/Budget saved for/).waitFor();
  const currentMonth = await page
    .getByLabel("Month", { exact: true })
    .inputValue();
  await page.getByLabel("Month", { exact: true }).fill("2020-01");
  await page.waitForFunction(
    () => document.querySelector("input[name=allowance]")?.value === "0",
  );
  await page.getByLabel("Allowance", { exact: true }).fill("750");
  await page.getByLabel("Savings Target", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Save Budget", exact: true }).click();
  await page.getByText("Budget saved for 2020-01.", { exact: true }).waitFor();
  await page.waitForFunction(
    () => document.querySelector("input[name=allowance]")?.value === "750",
  );
  await page.getByLabel("Month", { exact: true }).fill(currentMonth);
  await page.waitForFunction(
    () => document.querySelector("input[name=allowance]")?.value === "1000.5",
  );
  console.log(
    "PASS month-specific budget editing without replacing the current month",
  );

  await navigate("Categories");
  await page
    .getByRole("navigation", { name: "Categories sections" })
    .getByRole("button", { name: "Add Category", exact: true })
    .click();
  await page.getByLabel("Category Name", { exact: true }).fill("Food");
  await page.getByLabel("Planned Amount", { exact: true }).fill("500.25");
  await page
    .locator("form")
    .getByRole("button", { name: "Add Category", exact: true })
    .click();
  await page.getByText("Category added.", { exact: true }).waitFor();
  await navigate("Expenses");
  await page
    .getByRole("navigation", { name: "Expenses sections" })
    .getByRole("button", { name: "Add Expense", exact: true })
    .click();
  await page.getByLabel("Item", { exact: true }).fill("Lunch");
  await page.getByLabel("Amount", { exact: true }).fill("125.25");
  await page.getByRole("button", { name: "Add Spending", exact: true }).click();
  await page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/expenses" &&
      r.request().method() === "GET" &&
      r.status() === 200,
  );
  await navigate("Overview");
  await page.waitForFunction(() =>
    document
      .querySelector(".workspace-recent-list")
      ?.textContent.includes("Lunch"),
  );
  assert.match(await amount("Actual expenditure").innerText(), /125[,.]25/);
  assert.match(await amount("Remaining budget").innerText(), /875[,.]25/);
  assert.match(await amount("Planned expenditure").innerText(), /500[,.]25/);
  assert.equal(
    await page
      .getByRole("heading", {
        name: "Start with your first budget",
        exact: true,
      })
      .count(),
    0,
  );
  await page.reload();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  assert.match(await amount("Remaining budget").innerText(), /875[,.]25/);
  await page
    .getByLabel("Display currency", { exact: true })
    .selectOption("LSL");
  assert.equal(await amount("Remaining budget").innerText(), "M 875.25");
  await page.reload();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  assert.equal(await amount("Remaining budget").innerText(), "M 875.25");
  await screenshot("workspace-overview-desktop.png");
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Funded overflow " + width,
    );
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await screenshot("workspace-overview-mobile.png");
  await page
    .getByRole("button", { name: "Workspace menu", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  await drawer.waitFor();
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "detached" });
  console.log(
    "PASS real budget/category/expense creation, monthly totals, refresh and currency persistence, drawer and populated widths",
  );
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL(root + "/");
  await register(bob, "Second QA");
  await page
    .getByRole("heading", { name: "Start with your first budget", exact: true })
    .waitFor();
  assert.equal(await amount("Actual expenditure").innerText(), "M 0.00");
  assert.equal(await page.getByText("Lunch", { exact: true }).count(), 0);
  await navigate("Savings & planning");
  for (const label of ["Allowance", "Data / Contract", "Mokhatlo", "Savings"])
    assert.equal(
      await page.getByLabel(label, { exact: true }).inputValue(),
      "0",
    );
  assert.equal(
    await page
      .getByRole("button", { name: "Generate Plan", exact: true })
      .isDisabled(),
    true,
  );
  await navigate("Analytics");
  await page
    .getByRole("heading", {
      name: "Configure a budget to analyze this month",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".recharts-wrapper").count(), 0);
  await page
    .getByRole("button", { name: "Configure budget", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Budget", exact: true }).click();
  await page.getByText(/Budget saved for/).waitFor();
  await navigate("Overview");
  assert.equal(
    await page
      .getByRole("heading", {
        name: "Start with your first budget",
        exact: true,
      })
      .count(),
    0,
  );
  await page.getByText("Zero budget · no spending", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL(root + "/");
  if (await page.getByRole("button", { name: "Menu", exact: true }).isVisible())
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.locator('.public-nav a[href="/login"]').click();
  await page.getByLabel("Email", { exact: true }).fill(alice);
  await page.locator("input[type=password]").fill("regression-password-42");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  assert.equal(await amount("Remaining budget").innerText(), "M 875.25");
  console.log(
    "PASS logout/login persistence, second-user isolation, empty analytics and explicitly configured zero budget",
  );
  await page.setViewportSize({width:1440,height:1000});
  for (const route of ["budget","categories","recent-expenses","add-expense","add-category","graphs","spending-timetable","monthly-planner","category-survival","ai-recommendations","budget-intelligence","monthly-insights","can-i-buy","shopping-list","alerts","profile","notifications"]) {
    await page.goto(root+"/app/"+route);
    await page.locator(".workspace-page-heading h1").waitFor();
    await page.locator(".section-skeleton").waitFor({state:"detached"});
    if(route === "graphs") await page.locator(".recharts-wrapper").first().waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Module overflow "+route);
  }
  await page.goto(root+"/app/admin");await page.getByRole("heading",{name:"Access restricted",exact:true}).waitFor();
  console.log("PASS all retained module routes, real charts, notifications and role-gated administration");
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS real API browser workflow without runtime exceptions");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
