import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", acceptDownloads: true },
  reporter: [["list"]],
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true },
});
