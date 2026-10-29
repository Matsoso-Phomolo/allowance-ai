const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const root = process.env.PWA_TEST_URL || "http://127.0.0.1:5173";
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const errors = [];
  async function fresh(
    options = {},
    standalone = false,
    knownInstalled = false,
  ) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      ...options,
    });
    if (standalone)
      await context.addInitScript(() =>
        Object.defineProperty(navigator, "standalone", { value: true }),
      );
    if (knownInstalled)
      await context.addInitScript(() =>
        Object.defineProperty(navigator, "getInstalledRelatedApps", {
          value: () =>
            Promise.resolve([
              {
                platform: "webapp",
                url: location.origin + "/manifest.webmanifest",
              },
            ]),
        }),
      );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/health", (r) => r.fulfill({ json: { status: "ok" } }));
    await page.clock.install();
    await page.goto(root + "/");
    await page.getByRole("heading", { name: /Take control/ }).waitFor();
    return { context, page };
  }
  async function eligible(page, outcome = "dismissed") {
    await page.evaluate((outcome) => {
      window.installCalls = 0;
      const event = new Event("beforeinstallprompt", { cancelable: true });
      event.prompt = () => {
        window.installCalls++;
        return Promise.resolve();
      };
      event.userChoice = Promise.resolve({ outcome });
      window.dispatchEvent(event);
    }, outcome);
    await page
      .locator(".install-menu-action")
      .filter({ hasText: /^Install App$/ })
      .first()
      .waitFor({ state: "attached" });
  }
  async function advance(page) {
    await page.clock.fastForward(3000);
  }
  {
    const { context, page } = await fresh();
    await advance(page);
    assert.equal(
      await page.getByRole("dialog").count(),
      0,
      "No automatic popup without eligibility",
    );
    const action = page.getByRole("button", {
      name: "Install App · help",
      exact: true,
    });
    await action.click();
    await page.getByRole("dialog", { name: "Install AllowanceAI" }).waitFor();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Install App", exact: true })
        .count(),
      0,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await action.evaluate((e) => e === document.activeElement),
      true,
    );
    await context.close();
    console.log(
      "PASS unsupported browser guidance, Escape and focus restoration",
    );
  }
  {
    const { context, page } = await fresh({
      viewport: { width: 375, height: 812 },
    });
    await eligible(page);
    assert.equal(await page.getByRole("dialog").count(), 0);
    await advance(page);
    const dialog = page.getByRole("dialog", { name: "Install AllowanceAI" });
    await dialog.waitFor();
    assert.equal(
      await page.evaluate(() => installCalls),
      0,
      "No automatic native prompt",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Not Now", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await dialog.evaluate((e) => e.contains(document.activeElement)),
        true,
      );
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.keyboard.press("Escape");
    assert.ok(
      await page.evaluate(() =>
        localStorage.getItem("allowanceai_pwa_install_dismissed"),
      ),
    );
    await page.reload();
    await eligible(page);
    await advance(page);
    assert.equal(
      await page.getByRole("dialog").count(),
      0,
      "Dismissal persists",
    );
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Install App", exact: true })
      .click();
    await dialog.waitFor();
    await dialog
      .getByRole("button", { name: "Install App", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => installCalls), 1);
    await context.close();
    console.log(
      "PASS delayed eligible popup, mobile fit, focus trap, remembered dismissal, later native action and native dismissal",
    );
  }
  {
    const { context, page } = await fresh();
    await eligible(page, "accepted");
    await advance(page);
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog
      .getByRole("button", { name: "Install App", exact: true })
      .click();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await dialog.waitFor({ state: "detached" });
    assert.equal(
      await page.getByRole("button", { name: /Install App/ }).count(),
      0,
    );
    await page.reload();
    assert.equal(
      await page.getByRole("button", { name: /Install App/ }).count(),
      0,
      "Installed status persists",
    );
    await context.close();
    console.log(
      "PASS accepted installation, appinstalled cleanup and hidden installed controls",
    );
  }
  {
    const { context, page } = await fresh({}, true);
    await eligibleEventOnly(page);
    await advance(page);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page.getByRole("button", { name: /Install App/ }).count(),
      0,
    );
    await context.close();
    console.log("PASS standalone suppression");
  }
  {
    const { context, page } = await fresh({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 320, height: 740 },
      reducedMotion: "reduce",
    });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Install App · help", exact: true })
      .click();
    await page.getByText(/Open this website in Safari/).waitFor();
    await page
      .getByRole("button", { name: "Close installation popup" })
      .click();
    for (const path of ["/login", "/register"]) {
      await page.goto(root + path);
      await eligibleEventOnly(page);
      await advance(page);
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(
        await page
          .locator(".auth-panel .producer-credit, .auth-panel .install-control")
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator(".auth-panel")
          .getByRole("button", { name: /Install/ })
          .count(),
        0,
      );
    }
    await context.close();
    console.log(
      "PASS iOS instructions, reduced-motion layout and clean login/register forms",
    );
  }
  async function eligibleEventOnly(page) {
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
  }
  {
    const { context, page } = await fresh();
    await eligible(page);
    await advance(page);
    await page.getByRole("dialog").waitFor();
    await page.reload();
    await eligible(page);
    await advance(page);
    assert.equal(
      await page.getByRole("dialog").count(),
      0,
      "An impression is not repeated after refresh",
    );
    await page
      .getByRole("button", { name: "Install App", exact: true })
      .click();
    await page.evaluate(() => {
      window.duplicateCalls = 0;
      const duplicate = new Event("beforeinstallprompt", { cancelable: true });
      duplicate.prompt = () => {
        window.duplicateCalls++;
        return Promise.resolve();
      };
      duplicate.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(duplicate);
    });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Install App", exact: true })
      .click();
    assert.equal(await page.evaluate(() => installCalls), 1);
    assert.equal(await page.evaluate(() => duplicateCalls), 0);
    await context.close();
    console.log(
      "PASS impression persistence and duplicate eligibility suppression",
    );
  }
  {
    const { context, page } = await fresh();
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      e.prompt = () => Promise.reject(new Error("Test browser failure"));
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
    await advance(page);
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Install App", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: /could not open installation/ })
      .waitFor();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Install App", exact: true })
        .count(),
      0,
    );
    await context.close();
    console.log("PASS failed native prompt falls back to browser guidance");
  }
  {
    const { context, page } = await fresh({}, false, true);
    await page.waitForFunction(() =>
      Boolean(localStorage.getItem("allowanceai_pwa_installed")),
    );
    assert.equal(
      await page.getByRole("button", { name: /Install App/ }).count(),
      0,
    );
    await context.close();
    console.log("PASS same-origin installed related app detection");
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS no installation runtime exceptions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
