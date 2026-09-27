import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { csrf, join, login, verificationLink } from "./helpers";

export default async function setup(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: "http://localhost:8081" });
  const page = await context.newPage();
  try {
    await expect.poll(async () => (await context.request.get("/api/v1/auth/csrf")).status(),
      { timeout: 90_000 }).toBe(200);
    const suffix = randomBytes(8).toString("hex");
    const email = `admin-${suffix}@example.test`;
    const password = randomBytes(24).toString("base64url");
    await join(page, email, password, "테스트 운영진");
    await page.goto(await verificationLink(context.request, email));
    await expect(page.getByRole("status")).toContainText("이메일 확인을 마쳤습니다");
    expect(page.url()).not.toContain("#token=");

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      path.join(root, "deployment/bootstrap-e2e.ps1"), email], {
      cwd: root, env: process.env, timeout: 180_000, stdio: "pipe",
    });

    await login(page, email, password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: /이번 달 일정을 확인하세요/ })).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name === "SESSION" && cookie.secure && cookie.httpOnly)).toBe(true);

    const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric",
      month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (name: string) => dateParts.find((value) => value.type === name)?.value ?? "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const startAt = new Date(`${today}T18:00:00+09:00`).toISOString();
    const endAt = new Date(`${today}T20:00:00+09:00`).toISOString();
    const eventTitle = "비공개 연습";
    const noticeTitle = "회원 공지";
    const token = await csrf(context.request);
    const eventResponse = await context.request.post("/api/v1/admin/events", {
      headers: { "X-CSRF-TOKEN": token },
      data: { title: eventTitle, description: "격리 테스트 행사", startAt, endAt,
        obEligible: false, publicVisible: false },
    });
    expect(eventResponse.status()).toBe(201);
    const event = await eventResponse.json() as { id: number };
    const noticeResponse = await context.request.post("/api/v1/admin/notices", {
      headers: { "X-CSRF-TOKEN": await csrf(context.request) },
      data: { title: noticeTitle, body: "격리 테스트 공지", published: true },
    });
    expect(noticeResponse.status()).toBe(201);

    process.env.E2E_ADMIN_EMAIL = email;
    process.env.E2E_ADMIN_PASSWORD = password;
    process.env.E2E_EVENT_ID = String(event.id);
    process.env.E2E_EVENT_TITLE = eventTitle;
    process.env.E2E_NOTICE_TITLE = noticeTitle;
    process.env.E2E_TODAY = today;
  } finally {
    await browser.close();
  }
}
