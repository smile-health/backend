import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./packages/global-test",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 10000,
  expect: { timeout: 3000 },
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.WEB_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 5000,
    navigationTimeout: 8000,
    // Fastest headless configuration
    headless: true,
    launchOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      timeout: 15000,
    },
    {
      name: "chromium-fast",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "packages/global-test/.auth/user.json",
        // Additional speed optimizations
        viewport: { width: 1280, height: 720 }, // Smaller viewport
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      dependencies: ["setup"],
    },
    // Remove other browsers for maximum speed
  ],
});
