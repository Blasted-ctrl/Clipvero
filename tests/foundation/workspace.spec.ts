import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("PostgreSQL account, workspace settings, theme and session lifecycle", async ({
  page,
}) => {
  const email = `foundation-${crypto.randomUUID()}@example.com`;
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good ideas.Ready for the cut.",
  );
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
  await page.goto("/");
  await expect(page).toHaveURL(/\/overview$/);
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

test("PostgreSQL projects preserve scripts, autosave revisions and delete privately", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Project Creator");
  await page
    .getByLabel("Email address")
    .fill(`project-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("project creator secure password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  const script = "My exact original words. These scenes stay mine.";
  await page.goto("/features/ai-video-generator");
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Script", exact: true }).click();
  await page.getByLabel("Your script", { exact: true }).fill(script);
  await page.getByRole("button", { name: "Create video", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Your script", { exact: true })).toHaveValue(
    script,
  );
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Persisted original story");
  await page
    .getByRole("button", { name: "Open in editor", exact: true })
    .click();
  await expect(page.getByLabel("Caption text")).toHaveValue(script);
  await expect(
    page.getByRole("button", { name: "Render video", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Caption text").fill("My saved caption.");
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Caption text")).toHaveValue(
    "My saved caption.",
  );
  const id = page.url().split("/").pop();
  const response = await page.request.get(`/api/v1/projects/${id}/versions`);
  const history = await response.json();
  expect(history.length).toBeGreaterThan(1);
  expect(history.at(-1).timeline.scenes[0].script).toBe(script);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Persisted original story" })
    .click();
  await page
    .getByRole("button", { name: "Remove project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Persisted original story" }),
  ).toHaveCount(0);
  expect((await page.request.get(`/api/v1/projects/${id}`)).status()).toBe(404);
});
