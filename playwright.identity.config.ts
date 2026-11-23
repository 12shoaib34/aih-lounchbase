import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests-identity",
  workers: 1,
  timeout: 90000,
  use: { baseURL: "http://127.0.0.1:8841", channel: process.env.E2E_CHANNEL },
  webServer: {
    command: "npm run preview:identity",
    url: "http://127.0.0.1:8841/api/capabilities",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
