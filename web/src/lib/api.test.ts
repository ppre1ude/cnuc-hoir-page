import { afterEach, expect, test, vi } from "vitest";
import { apiRequest, onPermissionDenied } from "./api";

afterEach(() => vi.unstubAllGlobals());

test.each(["/auth/account-setup/confirm", "/admin/members/1/account-setup"])(
  "%s의 본문 없는 204 응답을 성공으로 처리합니다",
  async (path) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "csrf" }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error("본문 없음"); } });
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

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => body }));
}

test("회원 요청이 401이면 로그인으로 이동합니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", pathname: "/notices", search: "?notice=5", hash: "", replace } });
  respond(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." });
  await expect(apiRequest("/notices")).rejects.toMatchObject({ status: 401 });
  expect(replace).toHaveBeenCalledWith(new URL("/login#next=%2Fnotices%3Fnotice%3D5", "https://choir.example"));
});

test("세션 확인 요청의 401은 transport가 이동시키지 않습니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  respond(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." });
  await expect(apiRequest("/auth/me")).rejects.toMatchObject({ status: 401 });
  expect(replace).not.toHaveBeenCalled();
});

test("승인 필요 403이면 가입 상태 화면으로 이동합니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  respond(403, { code: "APPROVAL_REQUIRED", message: "승인 필요" });
  await expect(apiRequest("/notices")).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  expect(replace).toHaveBeenCalledWith(new URL("/application-status", "https://choir.example"));
});

test("권한 부족 403은 이동하지 않고 등록된 함수에 알립니다", async () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://choir.example", replace } });
  const listener = vi.fn();
  const unsubscribe = onPermissionDenied(listener);
  respond(403, { code: "PERMISSION_REQUIRED", message: "권한 없음" });
  await expect(apiRequest("/admin/notices")).rejects.toMatchObject({ code: "PERMISSION_REQUIRED" });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
  unsubscribe();
  await expect(apiRequest("/admin/notices")).rejects.toMatchObject({ code: "PERMISSION_REQUIRED" });
  expect(listener).toHaveBeenCalledTimes(1);
});
