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
