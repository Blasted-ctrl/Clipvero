import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("PostgreSQL account, workspace settings, theme and session lifecycle", async ({
  page,
}) => {
  const email = `foundation-${crypto.randomUUID()}@example.com`;
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Foundation Creator");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("foundation secure password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Foundation." }),
  ).toBeVisible();
  await expect(page.getByText("Video tools are being migrated.")).toBeVisible();
  const me = await page.request.get("/api/v1/auth/me");
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).credits).toBe(120);
  await page.getByRole("link", { name: "Workspace settings" }).click();
  await page.getByLabel("Your name").fill("Updated Creator");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Your name was saved.")).toBeVisible();
  await page.getByLabel("Workspace name").fill("Persisted Studio");
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(page.getByText("Workspace name saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Workspace name")).toHaveValue(
    "Persisted Studio",
  );
  await page.getByRole("button", { name: "Switch theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "test-results/foundation-settings.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("foundation secure password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Updated." }),
  ).toBeVisible();
});
