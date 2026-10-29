import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

const port = Number(process.env.NOVA_E2E_PORT || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("NOVA_E2E_PORT must be an integer between 1024 and 65535.");
}
const baseURL = `http://localhost:${port}`;
// CI uses the Playwright browser downloaded by `playwright install chromium`.
// This managed cloud image also provides a system Chromium for local checks.
const executablePath =
  process.env.CHROMIUM_PATH ||
  (!process.env.CI && existsSync("/usr/bin/chromium")
    ? "/usr/bin/chromium"
    : undefined);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL,
    launchOptions: { executablePath },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // Build explicitly beforehand. Never reuse the user's development server or DB.
  webServer: {
    command: `npm run db:migrate && npm exec -- next start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      BETTER_AUTH_URL: baseURL,
      NOVA_DATABASE_PATH: resolve("data", "e2e", `${randomUUID()}.sqlite`),
      NEXT_TELEMETRY_DISABLED: "1",
      NOVA_AI_API_KEY: "",
      NOVA_AI_MODEL: "poolside/laguna-s-2.1:free",
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
