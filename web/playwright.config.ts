import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = process.env.CHOIR_E2E_RUN_MANIFEST;
if (!manifestPath) {
  throw new Error("E2E는 npm run test:e2e 전용 런처로 실행해야 합니다.");
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  projectName: string;
  runToken: string;
  launcherPid: number;
  databasePasswordDigest: string;
  rootPasswordDigest: string;
  smtpPasswordDigest: string;
};
const digest = (value: string | undefined) => createHash("sha256").update(value ?? "").digest("hex");
if (!/^choir-portal-e2e-[a-f0-9]{32}$/.test(manifest.projectName)
    || manifest.projectName !== process.env.CHOIR_E2E_PROJECT_NAME
    || manifest.projectName !== process.env.COMPOSE_PROJECT_NAME
    || manifest.runToken !== process.env.CHOIR_E2E_RUN_TOKEN
    || !Number.isSafeInteger(manifest.launcherPid) || manifest.launcherPid <= 0
    || digest(process.env.E2E_DB_PASSWORD) !== manifest.databasePasswordDigest
    || process.env.MYSQL_PASSWORD !== process.env.E2E_DB_PASSWORD
    || digest(process.env.MYSQL_ROOT_PASSWORD) !== manifest.rootPasswordDigest
    || digest(process.env.SMTP_PASSWORD) !== manifest.smtpPasswordDigest) {
  throw new Error("격리 E2E 실행 식별자 또는 비밀번호가 일치하지 않습니다.");
}
const environment: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) environment[key] = value;
}
const portalBase = process.env.E2E_PORTAL_BASE_URL;
if (!portalBase || !/^http:\/\/localhost:\d{4,5}$/.test(portalBase)) {
  throw new Error("격리 E2E 웹 주소가 올바르지 않습니다.");
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: portalBase,
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  globalSetup: "./e2e/setup.ts",
  webServer: {
    command: "docker compose -f compose.portal.yaml -f deployment/compose.e2e.yaml up --build",
    cwd: projectRoot,
    url: `${portalBase}/api/v1/auth/csrf`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: environment,
  },
});
