import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("signup and the workspace meet the automated WCAG checks", async ({
  page,
}) => {
  await page.goto("/signup");
  const signup = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    signup.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByLabel("Your name").fill("Accessible Creator");
  await page
    .getByLabel("Email address")
    .fill(`accessible-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("an accessible test password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Your studio, Accessible." }),
  ).toBeVisible();
  const workspace = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    workspace.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
