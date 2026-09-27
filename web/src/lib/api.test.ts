import { afterEach, expect, test, vi } from "vitest";
import { apiRequest } from "./api";

afterEach(() => vi.unstubAllGlobals());

test.each(["/auth/applications", "/auth/resend-verification", "/auth/password-reset/request"])(
  "%s의 본문 없는 202 응답을 성공으로 처리합니다",
  async (path) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "csrf" }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => { throw new Error("본문 없음"); } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest<void>(path, { method: "POST" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);

test("출석 대상 아님 403은 승인 대기 화면으로 이동하지 않습니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false, status: 403, json: async () => ({ code: "NOT_ELIGIBLE", message: "출석 대상 아님" }),
  }));
  await expect(apiRequest("/events/3/attendance/me")).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  expect(replace).not.toHaveBeenCalled();
});
