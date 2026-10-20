import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { AdminAttendancePanel } from "./AdminAttendancePanel";
import * as attendance from "./attendance";
import * as events from "../event/events";
import QRCode from "qrcode";
import { renderWithSession, sessionFixture } from "../../test/session";
import { ApiRequestError } from "../../lib/api";

vi.mock("./attendance", async (importOriginal) => {
  const original = await importOriginal<typeof attendance>();
  return {
    ...original, getCheckInSession: vi.fn(), getAdminAttendance: vi.fn(), openCheckIn: vi.fn(),
    rotateCheckIn: vi.fn(), closeCheckIn: vi.fn(),
  };
});
vi.mock("../event/events", async (importOriginal) => {
  const original = await importOriginal<typeof events>();
  return { ...original, getEvent: vi.fn() };
});
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,abc") } }));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

test("출석 창 열기 성공 후 목록 갱신 실패는 조회만 재시도합니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue({ id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z",
    endAt: "2026-09-27T12:00:00Z", obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z" });
  vi.mocked(attendance.getCheckInSession)
    .mockResolvedValueOnce({ sessionId: null, expiresAt: null, open: false })
    .mockRejectedValueOnce(new Error("조회 실패"))
    .mockResolvedValueOnce({ sessionId: 7, expiresAt: "2026-09-27T10:10:00Z", open: true });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  vi.mocked(attendance.openCheckIn).mockResolvedValue({ sessionId: 7, expiresAt: "2026-09-27T10:10:00Z",
    qrUrl: "/events/3/check-in#token=secret", code: "ABCD2345" });

  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  fireEvent.click(await screen.findByRole("button", { name: "출석 창 열기" }));
  await screen.findByText(/변경은 완료됐지만/);
  expect(attendance.openCheckIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "출석 창 열기" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  await waitFor(() => expect(screen.queryByText(/변경은 완료됐지만/)).toBeNull());
  expect(attendance.openCheckIn).toHaveBeenCalledTimes(1);
  expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/localhost.*\/events\/3\/check-in#token=secret$/), expect.any(Object));
});

test("출석 기록을 받는 동안 빈 목록 안내 대신 불러오는 중이라고 알립니다", async () => {
  vi.mocked(events.getEvent).mockReturnValue(new Promise(() => undefined));
  vi.mocked(attendance.getCheckInSession).mockReturnValue(new Promise(() => undefined));
  vi.mocked(attendance.getAdminAttendance).mockReturnValue(new Promise(() => undefined));
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  expect(screen.getByRole("status")).toHaveTextContent("출석 기록을 불러오는 중입니다.");
  expect(screen.queryByText("출석 대상 단원이 없습니다.")).not.toBeInTheDocument();
});

const rehearsal = { id: 3, title: "연습", description: "설명", startAt: "2026-09-27T09:00:00Z", endAt: "2026-09-27T12:00:00Z",
  obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };
const issued = { sessionId: 7, expiresAt: "2026-09-27T10:10:00Z", qrUrl: "/events/3/check-in#token=secret", code: "ABCD2345" };

async function renderWithOpenWindow() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  const server = { session: { sessionId: null as number | null, expiresAt: null as string | null, open: false } };
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockImplementation(async () => server.session);
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  vi.mocked(attendance.openCheckIn).mockImplementation(async () => {
    server.session = { sessionId: 7, expiresAt: issued.expiresAt, open: true };
    return issued;
  });
  const view = renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  fireEvent.click(await screen.findByRole("button", { name: "출석 창 열기" }));
  await screen.findByText("ABCD2345");
  return { server, view };
}

test("유효 시간이 지나면 QR과 코드를 거두고 출석 창 열기를 다시 보입니다", async () => {
  const { server } = await renderWithOpenWindow();
  expect(await screen.findByRole("img", { name: "현장 출석 QR 코드" })).toBeInTheDocument();

  server.session = { sessionId: 7, expiresAt: issued.expiresAt, open: false };
  await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000));

  expect(await screen.findByRole("button", { name: "출석 창 열기" })).toBeInTheDocument();
  expect(screen.queryByText("ABCD2345")).toBeNull();
  expect(screen.queryByRole("img", { name: "현장 출석 QR 코드" })).toBeNull();
  expect(screen.queryByText(/까지 유효/)).toBeNull();
  expect(screen.getByText(/유효 시간이 지났습니다/)).toBeInTheDocument();
});

test("재발급이 실패하면 서버의 출석 창 상태를 다시 받아 보입니다", async () => {
  const { server } = await renderWithOpenWindow();
  server.session = { sessionId: 7, expiresAt: issued.expiresAt, open: false };
  vi.mocked(attendance.rotateCheckIn).mockRejectedValue(new ApiRequestError(409, "SESSION_CLOSED", "출석 창이 닫혔거나 만료되었습니다."));
  const sessionCalls = vi.mocked(attendance.getCheckInSession).mock.calls.length;

  fireEvent.click(screen.getByRole("button", { name: "QR과 코드 재발급" }));

  expect(await screen.findByRole("button", { name: "출석 창 열기" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("출석 창이 닫혔거나 만료되었습니다.");
  expect(screen.queryByText("ABCD2345")).toBeNull();
  expect(vi.mocked(attendance.getCheckInSession).mock.calls.length).toBeGreaterThan(sessionCalls);
});
