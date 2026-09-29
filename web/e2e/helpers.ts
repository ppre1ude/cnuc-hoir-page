import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function activate(page: Page, link: string, password: string): Promise<void> {
  await page.goto(link);
  await page.getByLabel("새 비밀번호").fill(password);
  await page.getByLabel("비밀번호 확인").fill(password);
  await page.getByRole("button", { name: "비밀번호 설정" }).click();
  await expect(page.getByRole("status")).toContainText("비밀번호가 설정되었습니다");
  expect(page.url()).not.toContain("#token=");
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

export async function csrf(request: APIRequestContext): Promise<string> {
  const response = await request.get("/api/v1/auth/csrf");
  expect(response.ok()).toBe(true);
  return (await response.json() as { token: string }).token;
}
