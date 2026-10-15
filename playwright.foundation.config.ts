import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/foundation",
  outputDir: "test-results/foundation",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: "list",
});
