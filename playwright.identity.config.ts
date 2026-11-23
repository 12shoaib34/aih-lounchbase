import {origin} from "./scripts/identity-endpoints.mjs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests-identity",
  workers: 1,
  timeout: 90000,
  use: { baseURL: origin, channel: process.env.E2E_CHANNEL },
  webServer: {
    command: "npm run preview:identity",
    url: origin+"/api/capabilities",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
