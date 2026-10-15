import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
test("creator can save, edit, render, review, and download a real video", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Browser Creator");
  await page
    .getByLabel("Email address")
    .fill(`creator-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("an isolated browser password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Your studio, Browser." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Script to video Bring your words to life" })
    .click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Browser acceptance short");
  await page
    .getByRole("textbox", { name: "Your script" })
    .fill("An original idea, ready for the world.");
  await page
    .getByRole("combobox", { name: "Duration", exact: true })
    .selectOption("5");
  await page
    .getByRole("checkbox", { name: "I own or have permission" })
    .check();
  await page.getByRole("button", { name: "Open in editor" }).click();
  await expect(page.getByLabel("Caption text")).toBeVisible();
  await page.getByLabel("Duration (sec)").fill("2");
  await page
    .getByLabel("Caption text")
    .fill("A real render. An original story.");
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Caption text")).toHaveValue(
    "An original idea, ready for the world.",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Caption text")).toHaveValue(
    "A real render. An original story.",
  );
  const editorUrl = page.url();
  await page.getByLabel("Caption text").fill("A saved story, ready to render.");
  await page.getByRole("link", { name: "Asset Library", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Asset library", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/original-frame.png" });
  const tone = spawnSync(
    ffmpeg!,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "test-results/original-tone.wav",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  expect(tone.status, tone.stderr).toBe(0);
  for (const filename of ["original-frame.png", "original-tone.wav"]) {
    await page
      .getByRole("button", { name: "Upload media", exact: true })
      .click();
    await page
      .getByLabel("Media file", { exact: true })
      .setInputFiles(resolve("test-results", filename));
    await page
      .getByLabel("Source & license", { exact: true })
      .fill(
        "Original test-created screenshot or synthesized tone. Owned by this test creator.",
      );
    await page.getByRole("dialog").getByRole("checkbox").check();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Upload media", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto(editorUrl);
  await expect(page.getByLabel("Caption text")).toHaveValue(
    "A saved story, ready to render.",
  );
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page
    .getByRole("button", { name: "original-frame.png", exact: true })
    .click();
  await page.getByRole("button", { name: "Style", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Background music", exact: true })
    .selectOption({ label: "original-tone.wav" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Caption text")).toHaveValue(
    "A saved story, ready to render.",
  );
  await page.getByLabel("Edit instruction").fill("captions at bottom");
  await page.getByRole("button", { name: "Propose edit" }).click();
  await expect(page.getByRole("dialog")).toContainText("captionPosition");
  await page.getByRole("button", { name: "Apply edit" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Render video" }).click();
  await expect(page.getByRole("button", { name: "View MP4" })).toBeVisible({
    timeout: 150000,
  });
  await page.getByRole("button", { name: "View MP4" }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).duration))
    .toBeGreaterThan(1.8);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Approved");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download MP4" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".mp4");
  await download.saveAs("test-results/acceptance-output.mp4");
  const probe = spawnSync(
    ffprobe.path,
    [
      "-v",
      "error",
      "-show_streams",
      "-of",
      "json",
      "test-results/acceptance-output.mp4",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  expect(probe.status, probe.stderr).toBe(0);
  const streams = JSON.parse(probe.stdout).streams as {
    codec_type: string;
    codec_name: string;
  }[];
  expect(
    streams.some((s) => s.codec_type === "video" && s.codec_name === "h264"),
  ).toBe(true);
  expect(streams.some((s) => s.codec_type === "audio")).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Review Queue" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser acceptance short" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Set reminder" }).click();
  const future = new Date(Date.now() + 86400000);
  future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
  await page
    .getByLabel("Local date and time")
    .fill(future.toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Save reminder" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByRole("link").filter({ hasText: "Browser acceptance short" }),
  ).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/overview");
    await expect(
      page.getByRole("heading", { name: "Your studio, Browser." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/overview-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
