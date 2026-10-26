import { afterEach, expect, test, vi } from "vitest";
import { ApiRequestError, apiRequest, clearRequestCache, onPermissionDenied } from "./api";

afterEach(() => { vi.unstubAllGlobals(); clearRequestCache(); });

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

test("코드와 메시지가 없는 서버 오류 본문에도 안내 문구를 붙입니다", async () => {
  respond(500, { timestamp: "2026-10-20T00:00:00Z", status: 500, error: "Internal Server Error", path: "/api/v1/attendance/me" });
  await expect(apiRequest("/attendance/me")).rejects.toMatchObject({
    status: 500, code: "REQUEST_FAILED", message: "서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.",
  });
});

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

test("같은 GET을 1분 안에 다시 부르면 서버에 묻지 않고, 동시에 부르면 한 번만 보냅니다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 1 }]));
  vi.stubGlobal("fetch", fetchMock);
  const [first, second] = await Promise.all([apiRequest("/notices"), apiRequest("/notices")]);
  expect(first).toBe(second);
  await apiRequest("/notices");
  await apiRequest("/notices?page=1");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("1분이 지나면 다시 받습니다", async () => {
  vi.useFakeTimers();
  try {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/notices");
    vi.advanceTimersByTime(60_000);
    await apiRequest("/notices");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

test("쓰기 요청이 끝나면 기억한 GET을 비웁니다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(ok({ token: "csrf" }));
  vi.stubGlobal("fetch", fetchMock);
  await apiRequest("/notices");
  await apiRequest("/notices/1/poll/vote", { method: "POST" });
  await apiRequest("/notices");
  // GET, CSRF, POST, 다시 GET
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("실패한 GET과 cache: \"reload\"는 새로 받고, 세션 확인은 기억하지 않습니다", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    .mockResolvedValue(ok({}));
  vi.stubGlobal("fetch", fetchMock);
  await expect(apiRequest("/events/1")).rejects.toBeInstanceOf(ApiRequestError);
  await apiRequest("/events/1");
  await apiRequest("/events/1", { cache: "reload" });
  await apiRequest("/auth/me");
  await apiRequest("/auth/me");
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

test("취소 신호가 달린 GET은 기억하지 않습니다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(ok([]));
  vi.stubGlobal("fetch", fetchMock);
  await apiRequest("/notices", { signal: new AbortController().signal });
  await apiRequest("/notices", { signal: new AbortController().signal });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
