import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default async function teardown(): Promise<void> {
  const projectName = process.env.COMPOSE_PROJECT_NAME ?? "";
  if (!/^choir-portal-e2e-[a-f0-9]{8}$/.test(projectName)
      || process.env.CHOIR_E2E_PROJECT_NAME !== projectName) {
    throw new Error("격리 테스트 프로젝트 이름이 일치하지 않아 정리를 중단했습니다.");
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  execFileSync("docker", ["compose", "-f", "compose.portal.yaml", "-f", "deployment/compose.e2e.yaml",
    "down", "-v", "--remove-orphans"], { cwd: root, env: process.env, timeout: 120_000, stdio: "inherit" });
}
