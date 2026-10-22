import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSession, useSessionState } from "./SessionProvider";
import { getSession, logout, rememberSession } from "./session";
import { ApiRequestError, apiRequest, redirectTo } from "../../lib/api";
import { sessionFixture } from "../../test/session";

vi.mock("./session", async (importOriginal) => ({ ...await importOriginal<typeof import("./session")>(), getSession: vi.fn() }));
vi.mock("../../lib/api", async (importOriginal) => ({ ...await importOriginal<typeof import("../../lib/api")>(), redirectTo: vi.fn() }));

function Probe() {
  const { status, session, refresh } = useSessionState();
  return <div>
    <p>상태:{status}</p>
    <p>이름:{session?.name ?? "없음"}</p>
    <button type="button" onClick={refresh}>새로 받기</button>
  </div>;
}

beforeEach(() => { vi.mocked(getSession).mockReset(); vi.mocked(redirectTo).mockReset(); rememberSession(null); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("승인된 세션을 받으면 준비 상태가 됩니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture({ name: "단원" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByText("상태:loading")).toBeInTheDocument();
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:단원")).toBeInTheDocument();
  expect(getSession).toHaveBeenCalledTimes(1);
});

test("레이아웃이 바뀌어 새로 생긴 provider는 마지막 세션으로 바로 그리고 다시 받아 맞춥니다", async () => {
  vi.mocked(getSession).mockResolvedValueOnce(sessionFixture({ name: "단원" }));
  const first = render(<SessionProvider><Probe /></SessionProvider>);
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  first.unmount();

  vi.mocked(getSession).mockResolvedValueOnce(sessionFixture({ name: "이름 바뀐 단원" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:단원")).toBeInTheDocument();
  expect(await screen.findByText("이름:이름 바뀐 단원")).toBeInTheDocument();
  expect(getSession).toHaveBeenCalledTimes(2);
});

test("로그아웃하면 기억한 세션을 비워 다음 provider는 다시 대기 상태로 시작합니다", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "csrf" }), { status: 200 })));
  vi.mocked(getSession).mockResolvedValueOnce(sessionFixture({ name: "단원" }));
  const first = render(<SessionProvider><Probe /></SessionProvider>);
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  first.unmount();
  await logout().catch(() => {});

  vi.mocked(getSession).mockReturnValueOnce(new Promise(() => {}));
  render(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByText("상태:loading")).toBeInTheDocument();
});

test("승인되지 않은 계정은 가입 상태 화면으로 보냅니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture({ status: "APPROVAL_PENDING", memberType: null }));
  render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/application-status"));
  expect(screen.getByText("상태:loading")).toBeInTheDocument();
});

test("401이면 로그인으로 보냅니다", async () => {
  window.history.replaceState(null, "", "/events/12/check-in#token=abc");
  try {
    vi.mocked(getSession).mockRejectedValue(new ApiRequestError(401, "UNAUTHENTICATED", "로그인이 필요합니다."));
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login#next=%2Fevents%2F12%2Fcheck-in%23token%3Dabc"));
    expect(getSession).toHaveBeenCalledTimes(1);
  } finally {
    window.history.replaceState(null, "", "/");
  }
});

test("처음 받다 실패하면 대기 상태를 유지한 채 한 번 자동으로 다시 받아 준비 상태가 됩니다", async () => {
  let succeed!: (value: ReturnType<typeof sessionFixture>) => void;
  vi.mocked(getSession).mockRejectedValueOnce(new ApiRequestError(502, "BAD_GATEWAY", "서버 오류"))
    .mockReturnValueOnce(new Promise((done) => { succeed = done; }));
  render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));
  // 자동 재시도 동안 실패 화면을 거치지 않습니다.
  expect(screen.getByText("상태:loading")).toBeInTheDocument();
  await act(async () => { succeed(sessionFixture({ name: "단원" })); });
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(getSession).toHaveBeenCalledTimes(2);
  expect(redirectTo).not.toHaveBeenCalled();
});

test("자동으로 다시 받아도 실패하면 실패 상태가 되고, 다시 받으면 준비 상태가 됩니다", async () => {
  vi.mocked(getSession).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(sessionFixture({ name: "단원" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  expect(await screen.findByText("상태:failed")).toBeInTheDocument();
  expect(getSession).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole("button", { name: "새로 받기" }));
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(redirectTo).not.toHaveBeenCalled();
});

test("운영진 영역은 운영진이 아니면 일정으로 보냅니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture());
  render(<SessionProvider requireStaff><Probe /></SessionProvider>);
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/dashboard"));
});

test("운영진 영역은 운영진이면 준비 상태가 됩니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  render(<SessionProvider requireStaff><Probe /></SessionProvider>);
  expect(await screen.findByText("상태:ready")).toBeInTheDocument();
  expect(redirectTo).not.toHaveBeenCalled();
});

test("처음 값을 받으면 요청하지 않고 바로 준비 상태입니다", () => {
  render(<SessionProvider initialSession={sessionFixture({ name: "관리자" })}><Probe /></SessionProvider>);
  expect(screen.getByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:관리자")).toBeInTheDocument();
  expect(getSession).not.toHaveBeenCalled();
});

test("다시 받다 실패해도 이미 받은 세션을 유지합니다", async () => {
  vi.mocked(getSession).mockRejectedValue(new TypeError("Failed to fetch"));
  render(<SessionProvider initialSession={sessionFixture({ name: "단원" })}><Probe /></SessionProvider>);
  await userEvent.click(screen.getByRole("button", { name: "새로 받기" }));
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
  expect(screen.getByText("상태:ready")).toBeInTheDocument();
  expect(screen.getByText("이름:단원")).toBeInTheDocument();
});

test("권한 부족 응답을 받으면 세션을 다시 받고, 운영진이 아니게 되면 일정으로 보냅니다", async () => {
  vi.mocked(getSession).mockResolvedValue(sessionFixture());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false, status: 403, json: async () => ({ code: "PERMISSION_REQUIRED", message: "권한 없음" }),
  }));
  render(<SessionProvider requireStaff initialSession={sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] })}><Probe /></SessionProvider>);
  await act(async () => { await apiRequest("/admin/notices").catch(() => undefined); });
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/dashboard"));
});

test("늦게 도착한 이전 응답은 버립니다", async () => {
  let resolveFirst: (value: ReturnType<typeof sessionFixture>) => void = () => undefined;
  vi.mocked(getSession)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(sessionFixture({ name: "새 세션" }));
  render(<SessionProvider><Probe /></SessionProvider>);
  await userEvent.click(screen.getByRole("button", { name: "새로 받기" }));
  expect(await screen.findByText("이름:새 세션")).toBeInTheDocument();
  await act(async () => { resolveFirst(sessionFixture({ name: "이전 세션" })); });
  expect(screen.getByText("이름:새 세션")).toBeInTheDocument();
});

test("준비되기 전에 useSession을 부르면 예외를 던집니다", () => {
  vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
  function Reader() { useSession(); return null; }
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(() => render(<SessionProvider><Reader /></SessionProvider>)).toThrow();
});

test("레이아웃이 바뀌어 사라진 provider의 늦은 응답은 리다이렉트하지 않습니다", async () => {
  let resolve!: (value: ReturnType<typeof sessionFixture>) => void;
  vi.mocked(getSession).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { unmount } = render(<SessionProvider requireStaff><Probe /></SessionProvider>);
  unmount();
  await act(async () => { resolve(sessionFixture()); });
  expect(redirectTo).not.toHaveBeenCalled();
});

test("사라진 provider는 처음 요청이 실패해도 다시 받지 않습니다", async () => {
  let fail!: (error: unknown) => void;
  vi.mocked(getSession).mockReturnValue(new Promise((_, reject) => { fail = reject; }));
  const { unmount } = render(<SessionProvider><Probe /></SessionProvider>);
  unmount();
  await act(async () => { fail(new TypeError("Failed to fetch")); });
  expect(getSession).toHaveBeenCalledTimes(1);
});
