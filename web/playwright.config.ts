import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectName = process.env.CHOIR_E2E_PROJECT_NAME ?? `choir-portal-e2e-${randomBytes(4).toString("hex")}`;
const databasePassword = process.env.E2E_DB_PASSWORD ?? randomBytes(24).toString("hex");
const environment = {
  ...process.env,
  CHOIR_E2E_PROJECT_NAME: projectName,
  COMPOSE_PROJECT_NAME: projectName,
  MYSQL_PASSWORD: databasePassword,
  MYSQL_ROOT_PASSWORD: randomBytes(24).toString("hex"),
  SMTP_HOST: "mailpit",
  SMTP_USER: "e2e",
  SMTP_PASSWORD: randomBytes(24).toString("hex"),
  MAIL_FROM: "choir-e2e@example.test",
  VERIFY_BASE_URL: "https://localhost/verify-email",
  PORTAL_HTTP_PORT: "8081",
  E2E_DB_PASSWORD: databasePassword,
};
Object.assign(process.env, environment);

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:8081",
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  globalSetup: "./e2e/setup.ts",
  globalTeardown: "./e2e/teardown.ts",
  webServer: {
    command: "docker compose -f compose.portal.yaml -f deployment/compose.e2e.yaml up --build",
    cwd: projectRoot,
    url: "http://localhost:8081/api/v1/auth/csrf",
    timeout: 600_000,
    reuseExistingServer: false,
    env: environment,
  },
});
