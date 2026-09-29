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

  const adminContext = await browser.newContext({ baseURL: process.env.E2E_PORTAL_BASE_URL });
  const adminPage = await adminContext.newPage();
  adminPage.on("pageerror", (error) => browserErrors.push(error.message));
  adminPage.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  try {
    await login(adminPage, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await adminPage.goto("/admin/applications");
    await expect(adminPage.getByRole("navigation", { name: "운영진 메뉴" }))
      .toContainText("가입 신청");
    const application = adminPage.getByRole("article").filter({ hasText: email });
    await expect(application).toBeVisible();
    await application.getByRole("button", { name: `${name} 승인` }).click();
    await expect(application).toHaveCount(0);

    await adminPage.goto("/admin/notices");
    await adminPage.getByLabel("제목").fill("연습 참여 조사");
    await adminPage.getByLabel("본문").fill("이번 주 연습 참여 여부를 선택해 주세요.");
    await adminPage.getByLabel("게시", { exact: true }).check();
    await adminPage.getByLabel("투표 추가").check();
    await adminPage.getByLabel("질문").fill("연습에 참석하시나요?");
    const deadlineParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric",
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(Date.now() + 86_400_000));
    const deadlinePart = (type: string) => deadlineParts.find((value) => value.type === type)?.value ?? "";
    await adminPage.getByLabel("마감 시각 (한국 시간)").fill(
      `${deadlinePart("year")}-${deadlinePart("month")}-${deadlinePart("day")}T${deadlinePart("hour")}:${deadlinePart("minute")}`);
    await adminPage.getByRole("button", { name: "저장" }).click();
    await expect(adminPage.getByRole("status")).toContainText("공지를 저장했습니다.");

    await adminPage.goto(`/admin/events/${eventId}/attendance`);
    await adminPage.getByRole("button", { name: "출석 창 열기" }).click();
    const code = await adminPage.locator('section[aria-label="출석 창"] strong').innerText();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);

    await login(page, email, password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/notices");
    await page.getByRole("button", { name: "연습 참여 조사" }).click();
    await page.getByRole("radio", { name: /^참석/ }).check();
    await page.getByRole("button", { name: "투표하기" }).click();
    await expect(page.getByText("내 선택: 참석")).toBeVisible();
    await page.getByRole("radio", { name: /^불참/ }).check();
    await page.getByRole("button", { name: "선택 변경" }).click();
    await expect(page.getByText("내 선택: 불참")).toBeVisible();
    await adminPage.goto("/admin/notices");
    await adminPage.getByRole("button", { name: /연습 참여 조사/ }).click();
    await expect(adminPage.getByRole("region", { name: "투표 결과" })).toContainText(email);
    await expect(adminPage.getByRole("region", { name: "투표 결과" })).toContainText("불참 1명");

    await page.goto("/dashboard");
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

    await adminPage.goto(`/admin/events/${eventId}/attendance`);
    const row = adminPage.locator("section[aria-label='단원 출석 기록'] > div").filter({ hasText: email });
    await expect(row).toContainText("출석 완료");
    await row.getByLabel("정정 이유").fill("현장 기록 확인");
    await row.getByRole("button", { name: "미출석으로 정정" }).click();
    await expect(row).toContainText(/· 미출석/);
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: eventTitle })).toContainText("미출석");

    const mobile = await browser.newContext({ baseURL: process.env.E2E_PORTAL_BASE_URL, viewport: { width: 390, height: 844 } });
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
        .toContainText(eventTitle);
      await expect(mobilePage.getByRole("region", { name: "내 출석 요약" }))
        .toContainText("미출석");
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

    await adminPage.setViewportSize({ width: 390, height: 844 });
    for (const [route, heading] of [
      ["/admin/applications", "가입 신청 관리"],
      ["/admin/notices", "공지 관리"],
      ["/admin/events", "행사 관리"],
      [`/admin/events/${eventId}/attendance`, `${eventTitle} 출석 관리`],
    ]) {
      await adminPage.goto(route);
      await expect(adminPage.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
    await adminPage.screenshot({ path: testInfo.outputPath("admin-attendance-mobile.png"), fullPage: true });
  } finally {
    await adminContext.close();
  }
  expect(browserErrors).toEqual([]);
});
