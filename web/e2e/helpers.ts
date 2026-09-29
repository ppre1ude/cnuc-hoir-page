import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function verificationLink(request: APIRequestContext, email: string): Promise<string> {
  const mailBase = process.env.E2E_MAIL_BASE_URL!;
  let identifier = "";
  await expect.poll(async () => {
    const response = await request.get(`${mailBase}/api/v1/messages`);
    if (!response.ok()) return false;
    const data = await response.json() as { messages?: Array<{ ID: string; To: unknown }> };
    const message = data.messages?.find((item) => JSON.stringify(item.To).includes(email));
    identifier = message?.ID ?? "";
    return Boolean(identifier);
  }, { timeout: 60_000, intervals: [500, 1000, 2000] }).toBe(true);
  const response = await request.get(`${mailBase}/api/v1/message/${identifier}`);
  expect(response.ok()).toBe(true);
  const message = await response.json() as { Text?: string };
  const link = message.Text?.match(/https?:\/\/[^\s]+\/verify-email#token=[^\s]+/)?.[0];
  expect(link).toBeTruthy();
  const url = new URL(link!);
  expect(url.protocol).toBe("https:");
  expect(url.hostname).toBe("localhost");
  return `${process.env.E2E_PORTAL_BASE_URL}${url.pathname}${url.search}${url.hash}`;
}

export async function join(page: Page, email: string, password: string, name: string): Promise<void> {
  await page.goto("/join");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "가입 신청" }).click();
  await expect(page.getByRole("status")).toContainText("가입 신청을 접수했습니다");
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
