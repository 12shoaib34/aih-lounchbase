import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:8817", channel: process.env.E2E_CHANNEL },
  webServer: {
    command: "npm run preview -- --port 8817",
    url: "http://127.0.0.1:8817/api/health",
    reuseExistingServer: !process.env.CI,
  },
});
