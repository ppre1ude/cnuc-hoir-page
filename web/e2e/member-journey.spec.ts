import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { join, login, verificationLink } from "./helpers";

test("가입부터 운영진 정정 반영까지 실제 서비스 흐름", async ({ browser, page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  const suffix = randomBytes(8).toString("hex");
  const email = `member-${suffix}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const name = "검증 단원";
  const eventId = Number(process.env.E2E_EVENT_ID);
  const eventTitle = process.env.E2E_EVENT_TITLE!;

  await join(page, email, password, name);
  await page.goto(await verificationLink(page.context().request, email));
  await expect(page.getByRole("status")).toContainText("이메일 확인을 마쳤습니다");
  expect(page.url()).not.toContain("#token=");
  await login(page, email, password);
  await expect(page).toHaveURL(/\/application-status$/);
  await expect(page.getByText("운영진 승인을 기다리고 있습니다.")).toBeVisible();

  const adminContext = await browser.newContext({ baseURL: "http://localhost:8081" });
  const adminPage = await adminContext.newPage();
  adminPage.on("pageerror", (error) => browserErrors.push(error.message));
  adminPage.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  try {
    await login(adminPage, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await adminPage.goto("/admin/applications");
    const application = adminPage.getByRole("article").filter({ hasText: email });
    await expect(application).toBeVisible();
    await application.getByRole("button", { name: `${name} 승인` }).click();
    await expect(application).toHaveCount(0);

    await adminPage.goto(`/admin/events/${eventId}/attendance`);
    await adminPage.getByRole("button", { name: "출석 창 열기" }).click();
    const code = await adminPage.locator('section[aria-label="출석 창"] strong').innerText();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);

    await login(page, email, password);
    await expect(page).toHaveURL(/\/dashboard$/);
    const calendar = page.getByRole("region", { name: "행사 달력" });
    const targetMonth = `${process.env.E2E_TODAY!.slice(0, 4)}년 ${process.env.E2E_TODAY!.slice(5, 7)}월`;
    const currentMonth = await calendar.locator("h2").innerText();
    if (currentMonth !== targetMonth) {
      const match = currentMonth.match(/^(\d+)년 (\d+)월$/);
      expect(match).not.toBeNull();
      const shown = Number(match![1]) * 12 + Number(match![2]);
      const target = Number(process.env.E2E_TODAY!.slice(0, 4)) * 12 + Number(process.env.E2E_TODAY!.slice(5, 7));
      expect(Math.abs(shown - target)).toBe(1);
      const direction = shown < target ? "다음 달" : "이전 달";
      await calendar.getByRole("button", { name: direction }).click();
      await expect(calendar.locator("h2")).toHaveText(targetMonth);
    }
    const day = Number(process.env.E2E_TODAY!.slice(-2));
    await calendar.locator(`button[aria-label^="${day}일"]`).click();
    await calendar.getByRole("button", { name: eventTitle }).click();
    const detail = page.getByRole("region", { name: "선택한 행사" });
    await expect(detail.getByRole("heading", { name: eventTitle })).toBeVisible();
    await detail.getByRole("link", { name: "현장 출석하기" }).click();
    await page.getByLabel("운영진이 알려준 출석 코드").fill(code);
    await page.getByRole("button", { name: "출석하기" }).click();
    await expect(page.locator('section[aria-label="현장 출석"] p[role="alert"]'))
      .toContainText("출석이 완료되었습니다");
    await page.goto("/attendance");
    await expect(page.getByRole("listitem").filter({ hasText: eventTitle })).toContainText("출석 완료");

    await adminPage.reload();
    const row = adminPage.locator("section[aria-label='단원 출석 기록'] > div").filter({ hasText: email });
    await expect(row).toContainText("출석 완료");
    await row.getByLabel("정정 이유").fill("현장 기록 확인");
    await row.getByRole("button", { name: "미출석으로 정정" }).click();
    await expect(row).toContainText(/· 미출석/);
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: eventTitle })).toContainText("미출석");

    const mobile = await browser.newContext({ baseURL: "http://localhost:8081", viewport: { width: 390, height: 844 } });
    const mobilePage = await mobile.newPage();
    mobilePage.on("pageerror", (error) => browserErrors.push(error.message));
    mobilePage.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    try {
      await login(mobilePage, email, password);
      await expect(mobilePage).toHaveURL(/\/dashboard$/);
      await expect(mobilePage.getByRole("region", { name: "선택한 행사" })).toBeVisible();
      await expect(mobilePage.getByRole("region", { name: "최근 공지" }))
        .toContainText(process.env.E2E_NOTICE_TITLE!);
      await expect(mobilePage.getByRole("region", { name: "내 출석 요약" }))
        .toContainText(`${eventTitle} · 미출석`);
      const metrics = await mobilePage.evaluate(() => {
        const names = ["행사 달력", "선택한 행사", "최근 공지", "내 출석 요약"];
        const tops = names.map((name) => document.querySelector(`[aria-label="${name}"]`)?.getBoundingClientRect().top ?? -1);
        return { viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, tops };
      });
      expect(metrics.viewport).toBe(390);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.tops.every((top) => top >= 0)).toBe(true);
      expect(metrics.tops).toEqual([...metrics.tops].sort((a, b) => a - b));
      await mobilePage.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
    } finally {
      await mobile.close();
    }
  } finally {
    await adminContext.close();
  }
  expect(browserErrors).toEqual([]);
});
