import { expect, test } from "@playwright/test";

test("방문자에게 회원 행사·공지·출석이 노출되지 않는다", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "전남대학교 합창단" })).toBeVisible();
  await expect(page.getByText(process.env.E2E_EVENT_TITLE!)).toHaveCount(0);
  await expect(page.getByText(process.env.E2E_NOTICE_TITLE!)).toHaveCount(0);
  const protectedPaths = [
    "/api/v1/notices",
    `/api/v1/events/${process.env.E2E_EVENT_ID}`,
    "/api/v1/events?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z",
    `/api/v1/events/${process.env.E2E_EVENT_ID}/attendance/me`,
    "/api/v1/attendance/me",
    "/api/v1/admin/applications",
  ];
  for (const path of protectedPaths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(process.env.E2E_EVENT_TITLE!);
    expect(body).not.toContain(process.env.E2E_NOTICE_TITLE!);
  }
  const publicEvents = await request.get("/api/v1/public/events");
  expect(publicEvents.status()).toBe(404);
  expect(await publicEvents.text()).not.toContain(process.env.E2E_EVENT_TITLE!);
  expect((await request.get(`/api/v1/public/events/${process.env.E2E_EVENT_ID}`)).status()).toBe(401);
  expect(errors).toEqual([]);
});
