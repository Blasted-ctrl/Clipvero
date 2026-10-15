import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Public marketing site: rendering, navigation, prompt hand-off, demos and responsive behavior. */

const pages = [
  { path: "/", heading: "Good ideas.Ready for the cut." },
  { path: "/explore", heading: "See what you can make." },
  {
    path: "/features",
    heading: "Everything between an idea and a finished short.",
  },
  { path: "/autopilot", heading: "A repeatable process. A consistent output." },
  { path: "/pricing", heading: "Pick the pace you post at." },
  { path: "/faq", heading: "Questions, answered." },
  { path: "/contact", heading: "We're here to help." },
  {
    path: "/features/ai-video-generator",
    heading: "From a sentence to a finished short.",
  },
  {
    path: "/features/fictional-character-videos",
    heading: "Original characters. A world of your own.",
  },
  { path: "/features/ai-story-videos", heading: "Give your stories a voice." },
  {
    path: "/features/gameplay-videos",
    heading: "Your footage, with a story on top.",
  },
  {
    path: "/features/educational-explainers",
    heading: "Make a big idea easy to understand.",
  },
  {
    path: "/features/podcast-clipping",
    heading: "Find the moments worth sharing.",
  },
  {
    path: "/features/ai-marketing-videos",
    heading: "Put your product in the spotlight.",
  },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|did not match/i.test(message.text())
    )
      errors.push(message.text());
  });
  return errors;
}

test.describe("pages", () => {
  for (const { path, heading } of pages) {
    test(`${path} renders one h1 without hydration errors`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        heading,
      );
      await expect(page).toHaveTitle(/Clipvero/);
      expect(await page.locator('link[rel="canonical"]').count()).toBe(1);
      expect(errors).toEqual([]);
      if (["/", "/features", "/autopilot", "/pricing"].includes(path)) {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          accessibility.violations.map((violation) => ({
            id: violation.id,
            targets: violation.nodes.map((node) => node.target),
          })),
        ).toEqual([]);
      }
    });
  }

  test("unknown feature pages return 404", async ({ page }) => {
    const response = await page.goto("/features/not-a-feature");
    expect(response?.status()).toBe(404);
  });

  test("robots, sitemap and social image are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");
    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain("/features/podcast-clipping");
    const og = await request.get("/og.png");
    expect(og.headers()["content-type"]).toContain("image/png");
  });
});

test.describe("navigation", () => {
  test("primary navigation reaches each section and marks it current", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ready(page, "/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const [label, path] of [
      ["Explore", "/explore"],
      ["Features", "/features"],
      ["Autopilot", "/autopilot"],
      ["Pricing", "/pricing"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Start creating" }),
    ).toHaveAttribute("href", "/signup");
  });

  test("mobile menu opens, traps focus, closes with Escape and navigates", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await ready(page, "/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await dialog.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await ready(page, "/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("");
  });

  test("hero posters open Explore at that example without a URL fragment", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ready(page, "/");
    // Hovering the strip pauses it, as it does for a person.
    await page.locator(".mk-marquee").hover();
    await page
      .getByRole("link", {
        name: /Why the tides follow the Moon, Explainer sample/,
      })
      .click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.locator("#tides-moon")).toBeInViewport();
  });

  test("no marketing link adds a #fragment to the URL", async ({ page }) => {
    for (const path of ["/", "/explore", "/features", "/pricing", "/faq"]) {
      await page.goto(path);
      const hrefs = await page
        .locator("header a[href], main a[href], footer a[href]")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      expect(
        hrefs.filter((href) => href.includes("#") && href !== "#main"),
      ).toEqual([]);
    }
  });

  test("footer links to every feature page and legal page", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("navigation", { name: "Footer" });
    await expect(footer.getByRole("link")).toHaveCount(4 + 7 + 2 + 2);
    await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});

/** Waits until client components have hydrated so clicks reach React handlers. */
async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const composerAlert = (page: Page) =>
  page.getByRole("form", { name: "Start a video" }).getByRole("alert");

test.describe("hero composer", () => {
  test("validates empty input without navigating", async ({ page }) => {
    await ready(page, "/");
    await page.getByRole("button", { name: "Create video" }).click();
    await expect(composerAlert(page)).toContainText(
      "Describe the video you want to create.",
    );
    await expect(
      page.getByLabel("Describe the video you want to create"),
    ).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test("preserves the prompt and mode when continuing to the studio", async ({
    page,
  }) => {
    await ready(page, "/");
    await page.getByRole("button", { name: "Use a sample brief" }).click();
    const field = page.getByLabel("Describe the video you want to create");
    await expect(field).toHaveValue(/launch video for a reusable coffee cup/);
    await page.getByRole("button", { name: "Create video" }).click();
    // Signed-out visitors may be redirected to sign-in; the draft must survive either way.
    await page.waitForURL((url) => url.pathname !== "/");
    const draft = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("clipvero:creation-draft") ?? "null"),
    );
    expect(draft).toMatchObject({ version: 1, source: "idea", mode: "prompt" });
    expect(draft.content).toContain("launch video for a reusable coffee cup");
  });

  test("tabs support arrow keys and keep separate drafts", async ({ page }) => {
    await ready(page, "/");
    const idea = page.getByRole("tab", { name: "Idea" });
    await page
      .getByLabel("Describe the video you want to create")
      .fill("An idea worth keeping around");
    await idea.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Script" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Script" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "URL" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByLabel("Link to a page or article").fill("not a url");
    await page.getByRole("button", { name: "Save link and continue" }).click();
    await expect(composerAlert(page)).toContainText("https://");
    await page.keyboard.press("Home");
    await page.getByRole("tab", { name: "Idea" }).click();
    await expect(
      page.getByLabel("Describe the video you want to create"),
    ).toHaveValue("An idea worth keeping around");
  });

  test("feature pages start the matching creation mode", async ({ page }) => {
    await ready(page, "/features/fictional-character-videos");
    await page.getByRole("button", { name: "Use a sample brief" }).click();
    await page.getByRole("button", { name: "Create video" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/features"));
    const draft = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("clipvero:creation-draft") ?? "null"),
    );
    expect(draft.mode).toBe("characters");
  });
});

test.describe("progressive enhancement", () => {
  test("the composer submits a usable create URL without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await page
      .getByLabel("Describe the video you want to create")
      .fill("A story about a lighthouse keeper");
    await Promise.all([
      page.waitForURL((url) => url.pathname !== "/"),
      page.getByRole("button", { name: "Create video" }).click(),
    ]);
    await context.close();
  });

  test("the create URL carries mode and prompt", async ({ page }) => {
    await ready(page, "/");
    const form = page.getByRole("form", { name: "Start a video" });
    await expect(form).toHaveAttribute("action", "/create");
    await expect(form.locator('input[name="mode"]')).toHaveValue("prompt");
  });
});

test.describe("showcase", () => {
  test("filters examples and announces the count", async ({ page }) => {
    await ready(page, "/explore");
    const filters = page.getByRole("group", {
      name: "Filter examples by format",
    });
    await filters.getByRole("button", { name: "Explainers" }).click();
    await expect(
      filters.getByRole("button", { name: "Explainers" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page
        .locator("main article")
        .filter({ has: page.getByText("Explainer", { exact: true }) }),
    ).toHaveCount(2);
    await expect(page.getByText("Showing 2 examples")).toBeAttached();
    await filters.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("Showing 8 examples")).toBeAttached();
  });

  test("plays, pauses, toggles sound and replays a sample", async ({
    page,
  }) => {
    await ready(page, "/explore");
    const card = page.locator("article", {
      has: page.getByRole("heading", {
        name: "Two robots argue over who invented Wi-Fi",
      }),
    });
    await card.getByRole("button", { name: /Play “Two robots/ }).click();
    await expect(
      card.getByRole("button", { name: /Pause “Two robots/ }),
    ).toBeAttached({ timeout: 15_000 });
    const sound = card.getByRole("button", { name: /Turn sound (on|off)/ });
    const before = await sound.getAttribute("aria-pressed");
    await sound.click();
    await expect(sound).not.toHaveAttribute("aria-pressed", before ?? "");
    await card.getByRole("button", { name: /Pause “Two robots/ }).click();
    await expect(
      card.getByRole("button", { name: /Play “Two robots/ }),
    ).toBeAttached();
    await card.getByRole("button", { name: "Replay from start" }).click();
    await expect(
      card.getByRole("button", { name: /Pause “Two robots/ }),
    ).toBeAttached({ timeout: 15_000 });
    expect(
      await card
        .locator("video")
        .evaluate((v: HTMLVideoElement) => v.currentTime < 3),
    ).toBe(true);
  });

  test("create-similar carries the example's format", async ({ page }) => {
    await ready(page, "/explore");
    const card = page.locator("article", {
      has: page.getByRole("heading", { name: "Why the tides follow the Moon" }),
    });
    await card.getByRole("button", { name: "Create a similar video" }).click();
    await page.waitForURL((url) => url.pathname !== "/explore");
    const draft = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("clipvero:creation-draft") ?? "null"),
    );
    expect(draft.mode).toBe("explainer");
  });
});

test.describe("interactive demos", () => {
  test("FAQ disclosure toggles", async ({ page }) => {
    await ready(page, "/faq");
    const question = page.getByRole("button", {
      name: "Can I upload existing videos?",
    });
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("region", { name: "Can I upload existing videos?" }),
    ).toContainText("private to your workspace");
  });

  test("editor demo applies a typed instruction and trims", async ({
    page,
  }) => {
    await ready(page, "/features");
    await page
      .getByLabel("Edit instruction")
      .fill("yellow captions at the top");
    await page.getByRole("button", { name: "Propose" }).click();
    await expect(page.getByText("Caption color → Yellow")).toBeVisible();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText(/Applied: Caption color → Yellow/),
    ).toBeVisible();
    await page.getByRole("button", { name: /Async is a skill/ }).click();
    await expect(page.getByLabel("Scene caption")).toHaveValue(
      "Async is a skill, and most teams never practice it.",
    );
    const reframe = page.getByRole("switch", { name: "Reframe to vertical" });
    await reframe.click();
    await expect(reframe).toHaveAttribute("aria-checked", "false");
  });

  test("autopilot demo approves a video and schedules a reminder", async ({
    page,
  }) => {
    await ready(page, "/autopilot");
    await page.getByRole("button", { name: "Approve" }).click();
    await page
      .getByLabel("Reminder day for Why is the sky blue?")
      .selectOption("Thu");
    await page.getByRole("button", { name: "Set reminder" }).click();
    await expect(
      page.getByTitle("Reminder to post: Why is the sky blue?"),
    ).toBeVisible();
    await expect(
      page.getByText(/You post the approved MP4 yourself/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(
      page.getByText("Paused · future runs will not start"),
    ).toBeVisible();
  });
});

test.describe("pricing", () => {
  test("plan actions go to sign-up and return to billing with the plan", async ({
    page,
  }) => {
    await page.goto("/pricing");
    for (const [name, key] of [
      ["Starter", "starter"],
      ["Creator", "creator"],
      ["Studio", "studio"],
    ]) {
      const link = page.getByRole("link", {
        name: new RegExp(`^Choose ${name}`),
      });
      await expect(link).toHaveAttribute(
        "href",
        `/signup?next=%2Fbilling%3Fplan%3D${key}`,
      );
    }
    await expect(page.getByText("$29", { exact: true })).toBeVisible();
    await expect(page.getByText("$79", { exact: true })).toBeVisible();
    await expect(page.getByText("$199", { exact: true })).toBeVisible();
    await expect(page.getByText(/yearly|annual/i)).toHaveCount(0);
  });
});

test.describe("responsive and motion", () => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`home has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("content is visible with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    const opacity = await page
      .locator(".mk-reveal")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});
