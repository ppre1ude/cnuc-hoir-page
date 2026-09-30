import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(webRoot, "..");
const projectName = `choir-portal-e2e-${randomBytes(16).toString("hex")}`;
const databasePassword = randomBytes(32).toString("hex");
const runToken = randomBytes(32).toString("hex");
const composeFiles = ["-f", "compose.portal.yaml", "-f", "deployment/compose.e2e.yaml"];
const environment = {
  ...process.env,
  CHOIR_E2E_PROJECT_NAME: projectName,
  COMPOSE_PROJECT_NAME: projectName,
  POSTGRES_PASSWORD: databasePassword,
  E2E_DB_PASSWORD: databasePassword,
  CHOIR_E2E_RUN_TOKEN: runToken,
};

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root, env: environment, encoding: "utf8", timeout: 120_000,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Docker 명령이 실패했습니다: ${result.error?.message ?? result.stderr?.trim() ?? result.status}`);
  }
  return result.stdout?.trim() ?? "";
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("루프백 포트를 선택하지 못했습니다."));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

const selectedPorts = new Set();
while (selectedPorts.size < 2) selectedPorts.add(await availablePort());
const [portalPort, databasePort] = [...selectedPorts];
environment.PORTAL_HTTP_PORT = String(portalPort);
environment.E2E_DB_PORT = String(databasePort);
environment.E2E_PORTAL_BASE_URL = `http://localhost:${portalPort}`;

const usedSubnets = new Set(lines(docker(["network", "ls", "-q"]))
  .flatMap((id) => JSON.parse(docker(["network", "inspect", id]))
    .flatMap((network) => (network.IPAM?.Config ?? []).map((config) => config.Subnet))));
const subnetNumber = Array.from({ length: 14 }, (_, index) => index + 241)
  .find((value) => !usedSubnets.has(`172.30.${value}.0/24`));
if (!subnetNumber) throw new Error("격리 테스트에 사용할 내부 네트워크가 없습니다.");
environment.E2E_API_PRIVATE_SUBNET = `172.30.${subnetNumber}.0/24`;
environment.E2E_PROXY_IP = `172.30.${subnetNumber}.10`;

function resources() {
  return {
    containers: lines(docker(["ps", "-aq", "--filter", `name=${projectName}`])),
    volumes: lines(docker(["volume", "ls", "-q", "--filter", `name=${projectName}`])),
    networks: lines(docker(["network", "ls", "--format", "{{.Name}}", "--filter", `name=${projectName}`])),
  };
}

function assertOwnedResources(found) {
  const allowedServices = new Set(["postgres", "api", "web", "proxy"]);
  for (const id of found.containers) {
    const [container] = JSON.parse(docker(["inspect", "--type", "container", id]));
    const labels = container.Config?.Labels ?? {};
    if (labels["com.docker.compose.project"] !== projectName
        || !allowedServices.has(labels["com.docker.compose.service"])
        || !container.Name?.startsWith(`/${projectName}-`)) {
      throw new Error("격리 프로젝트에 속하지 않은 컨테이너가 있어 정리를 중단했습니다.");
    }
  }
  for (const name of found.volumes) {
    const [volume] = JSON.parse(docker(["volume", "inspect", name]));
    if (name !== `${projectName}_portal_postgres_data`
        || volume.Labels?.["com.docker.compose.project"] !== projectName) {
      throw new Error("격리 프로젝트에 속하지 않은 볼륨이 있어 정리를 중단했습니다.");
    }
  }
  const allowedNetworks = new Set(["api_private", "web_private", "edge"]);
  for (const name of found.networks) {
    const [network] = JSON.parse(docker(["network", "inspect", name]));
    const suffix = name.startsWith(`${projectName}_`) ? name.slice(projectName.length + 1) : "";
    if (!allowedNetworks.has(suffix)
        || network.Labels?.["com.docker.compose.project"] !== projectName) {
      throw new Error("격리 프로젝트에 속하지 않은 네트워크가 있어 정리를 중단했습니다.");
    }
  }
}

const existing = resources();
if (Object.values(existing).some((items) => items.length > 0)) {
  throw new Error("같은 이름의 Docker 자원이 이미 있어 격리 실행을 중단했습니다.");
}

const runDirectory = mkdtempSync(path.join(tmpdir(), "choir-e2e-"));
const manifestPath = path.join(runDirectory, "run.json");
const digest = (value) => createHash("sha256").update(value).digest("hex");
writeFileSync(manifestPath, JSON.stringify({
  projectName, runToken, launcherPid: process.pid,
  databasePasswordDigest: digest(databasePassword),
}), { flag: "wx", mode: 0o600 });
environment.CHOIR_E2E_RUN_MANIFEST = manifestPath;

let exitCode = 1;
try {
  console.log(`격리 테스트 프로젝트: ${projectName}`);
  const result = spawnSync(process.execPath,
    [path.join(webRoot, "node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)],
    { cwd: webRoot, env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.projectName !== projectName || manifest.runToken !== runToken) {
      throw new Error("격리 실행 식별자가 바뀌어 정리를 중단했습니다.");
    }
    const found = resources();
    assertOwnedResources(found);
    if (Object.values(found).some((items) => items.length > 0)) {
      docker(["compose", ...composeFiles, "down", "-v"], { stdio: "inherit" });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    exitCode = 1;
  } finally {
    unlinkSync(manifestPath);
    rmdirSync(runDirectory);
  }
}
process.exitCode = exitCode;
