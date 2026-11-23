import { defineConfig } from "@playwright/test";
const port = process.env.E2E_PORT || "8817";
const origin = "http://127.0.0.1:"+port;
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: origin, channel: process.env.E2E_CHANNEL },
  webServer: {
    command: "npm run preview -- --port "+port,
    url: origin+"/api/health",
    reuseExistingServer: !process.env.CI,
  },
});
