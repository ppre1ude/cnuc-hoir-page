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
    rotateCheckIn: vi.fn(), closeCheckIn: vi.fn(), correctAttendance: vi.fn(),
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
    endAt: "2026-09-27T12:00:00Z", kind: "EVENT", part: null, obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z", cancelledAt: null });
  vi.mocked(attendance.getCheckInSession)
    .mockResolvedValueOnce({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" })
    .mockRejectedValueOnce(new Error("조회 실패"))
    .mockResolvedValueOnce({ sessionId: 7, expiresAt: "2026-09-27T10:10:00Z", open: true, code: "ABCD2345", opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  vi.mocked(attendance.openCheckIn).mockResolvedValue({ sessionId: 7, expiresAt: "2026-09-27T10:10:00Z",
    qrUrl: "/events/3/check-in#token=secret", code: "ABCD2345" });

  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  fireEvent.click(await screen.findByRole("button", { name: "출석 받기" }));
  await screen.findByText(/변경은 완료됐지만/);
  expect(attendance.openCheckIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "출석 받기" })).toBeNull();
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
  kind: "EVENT" as const, part: null, obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", cancelledAt: null as string | null };
// 서버는 expiresAt에 행사 종료 시각을 줍니다. rehearsal은 12:00에 끝납니다.
const issued = { sessionId: 7, expiresAt: "2026-09-27T12:00:00Z", qrUrl: "/events/3/check-in#token=secret", code: "ABCD2345" };

test("취소된 일정은 출석 창을 열 수 없다고 안내하고 여는 버튼을 숨긴다", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  vi.mocked(events.getEvent).mockResolvedValue({ ...rehearsal, cancelledAt: "2026-09-27T09:30:00Z" });
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: 7, expiresAt: "2026-09-27T12:00:00Z", open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  expect(await screen.findByText(/취소된 일정이라 출석 창을 열 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "다시 열기" })).not.toBeInTheDocument();
  vi.useRealTimers();
});

async function renderWithOpenWindow() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  const server = { session: { sessionId: null as number | null, expiresAt: null as string | null, open: false, code: null as string | null, opensAt: "2026-09-27T08:30:00Z" } };
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockImplementation(async () => server.session);
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  vi.mocked(attendance.openCheckIn).mockImplementation(async () => {
    server.session = { sessionId: 7, expiresAt: issued.expiresAt, open: true, code: "ABCD2345", opensAt: "2026-09-27T08:30:00Z" };
    return issued;
  });
  const view = renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
  fireEvent.click(await screen.findByRole("button", { name: "출석 받기" }));
  await screen.findByText("ABCD2345");
  return { server, view };
}

test("연습이 끝나면 QR과 코드를 거두고 다시 열기 대신 정정을 안내합니다", async () => {
  const { server } = await renderWithOpenWindow();
  expect(await screen.findByRole("img", { name: "현장 출석 QR 코드" })).toBeInTheDocument();

  // 옛 10분 규칙과 달리 연습 중에는 10분이 지나도 코드가 그대로 있습니다.
  await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000));
  expect(screen.getByText("ABCD2345")).toBeInTheDocument();

  // 다른 기기에서 창을 닫아 이 화면이 닫힌 창을 보는 채로 연습이 끝나도 종료 시각에 안내가 바뀌어야 합니다.
  server.session = { sessionId: 7, expiresAt: issued.expiresAt, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" };
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(await screen.findByRole("button", { name: "다시 열기" })).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000));

  expect(await screen.findByText(/연습이 끝나 출석 창을 열 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "다시 열기" })).toBeNull();
  expect(screen.queryByText("ABCD2345")).toBeNull();
  expect(screen.queryByRole("img", { name: "현장 출석 QR 코드" })).toBeNull();
  expect(screen.queryByText(/연습 끝 .*까지/)).toBeNull();
});

test("연습이 끝난 행사는 한 번도 열지 않았어도 출석 받기 버튼을 숨깁니다", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T13:00:00Z"));
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: "2026-09-27T12:00:00Z", open: false,
    code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  expect(await screen.findByText(/연습이 끝나 출석 창을 열 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "출석 받기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "다시 열기" })).toBeNull();
});

test("재발급이 실패하면 서버의 출석 창 상태를 다시 받아 보입니다", async () => {
  const { server } = await renderWithOpenWindow();
  server.session = { sessionId: 7, expiresAt: issued.expiresAt, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" };
  vi.mocked(attendance.rotateCheckIn).mockRejectedValue(new ApiRequestError(409, "SESSION_CLOSED", "출석 창이 닫혔거나 만료되었습니다."));
  const sessionCalls = vi.mocked(attendance.getCheckInSession).mock.calls.length;

  fireEvent.click(screen.getByRole("button", { name: "QR과 코드 재발급" }));

  expect(await screen.findByRole("button", { name: "다시 열기" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("출석 창이 닫혔거나 만료되었습니다.");
  expect(screen.queryByText("ABCD2345")).toBeNull();
  expect(vi.mocked(attendance.getCheckInSession).mock.calls.length).toBeGreaterThan(sessionCalls);
});

test("출석 창을 열기 전에 출석 대상과 미출석 규칙을 보입니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue({ ...rehearsal, kind: "PART_REHEARSAL", part: "TENOR", obEligible: true });
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  await screen.findByRole("button", { name: "출석 받기" });
  expect(screen.getByText("테너 단원 · OB")).toBeInTheDocument();
  expect(screen.getByText(/출석하지 않은 대상 단원은 미출석으로 남습니다/)).toBeInTheDocument();
  expect(screen.queryByText("파트연습에는 출석 창을 열지 마세요.")).not.toBeInTheDocument();
});

const sora = { memberId: 11, name: "김소라", part: "SOPRANO" as const, cohort: 5, checkedInAt: null, correctedAt: null };

test("출석 명단은 이메일 없이 이름 옆에 파트와 기수를 보입니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "CHECKED_IN" },
    { memberId: 12, name: "이하늘", part: null, cohort: null, status: "MISSED", checkedInAt: null, correctedAt: null }]);
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  expect(await screen.findByText("김소라 소프라노 5기")).toBeInTheDocument();
  expect(screen.getByText("이하늘")).toBeInTheDocument();
  expect(screen.getByLabelText("단원 출석 기록")).not.toHaveTextContent("@");
});

test("정정 이유를 적기 전에는 정정 버튼이 꺼져 있고, 적으면 그 단원만 정정합니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "MISSED" },
    { memberId: 12, name: "이하늘", part: null, cohort: null, status: "MISSED", checkedInAt: null, correctedAt: null }]);
  vi.mocked(attendance.correctAttendance).mockResolvedValue();
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  // 정정 칸은 왼쪽 목록에서 고른 단원 것만 보입니다.
  expect(await screen.findByText("왼쪽 목록에서 단원을 고르면 출석 기록과 정정 칸이 나옵니다.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^김소라/ }));
  const checkIn = screen.getByRole("button", { name: "김소라 출석으로 정정" });
  expect(checkIn).toBeDisabled();
  expect(screen.getByRole("button", { name: "김소라 미출석으로 정정" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("김소라 정정 이유"), { target: { value: "  " } });
  expect(checkIn).toBeDisabled();
  fireEvent.change(screen.getByLabelText("김소라 정정 이유"), { target: { value: "지각 확인" } });
  expect(checkIn).toBeEnabled();
  // 다른 단원으로 옮겨도 적어 둔 이유는 남고, 그 단원 버튼은 따로 꺼져 있습니다.
  fireEvent.click(screen.getByRole("button", { name: /^이하늘/ }));
  expect(screen.getByRole("button", { name: "이하늘 출석으로 정정" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "김소라 출석으로 정정" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^김소라/ }));
  expect(screen.getByRole("button", { name: "김소라 출석으로 정정" })).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "김소라 출석으로 정정" }));
  await waitFor(() => expect(attendance.correctAttendance).toHaveBeenCalledWith(3, 11, "CHECKED_IN", "지각 확인"));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("출석 창이 열린 동안 아직 출석하지 않은 단원은 출석 전으로 보입니다", async () => {
  await renderWithOpenWindow();
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "NOT_OPEN" }]);
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  expect(await screen.findByText(/출석 전/)).toBeInTheDocument();
  expect(screen.queryByText(/출석 창 대기/)).toBeNull();
});

test("출석 창이 열린 동안 15초마다 명단을 다시 받고 QR과 코드는 그대로 둡니다", async () => {
  await renderWithOpenWindow();
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "CHECKED_IN" }]);
  const rosterCalls = () => vi.mocked(attendance.getAdminAttendance).mock.calls.length;
  const before = rosterCalls();

  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(rosterCalls()).toBe(before + 1);
  expect(await screen.findByText(/출석 완료/)).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(rosterCalls()).toBe(before + 2);
  expect(screen.getByText("ABCD2345")).toBeInTheDocument();
  expect(attendance.openCheckIn).toHaveBeenCalledTimes(1);
  expect(attendance.rotateCheckIn).not.toHaveBeenCalled();
});

test("출석 창을 닫거나 화면을 떠나면 명단 자동 갱신을 멈춥니다", async () => {
  const { server, view } = await renderWithOpenWindow();
  vi.mocked(attendance.closeCheckIn).mockImplementation(async () => {
    server.session = { sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" };
  });
  fireEvent.click(screen.getByRole("button", { name: "출석 창 닫기" }));
  await screen.findByRole("button", { name: "출석 받기" });
  const afterClose = vi.mocked(attendance.getAdminAttendance).mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(vi.mocked(attendance.getAdminAttendance).mock.calls.length).toBe(afterClose);

  fireEvent.click(screen.getByRole("button", { name: "출석 받기" }));
  await screen.findByText("ABCD2345");
  view.unmount();
  const afterUnmount = vi.mocked(attendance.getAdminAttendance).mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(vi.mocked(attendance.getAdminAttendance).mock.calls.length).toBe(afterUnmount);
});

test("목록 다시 불러오기는 오류가 없어도 보이고 QR과 코드를 둔 채 명단을 다시 받습니다", async () => {
  await renderWithOpenWindow();
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "CHECKED_IN" }]);
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));

  expect(await screen.findByText(/출석 완료/)).toBeInTheDocument();
  expect(screen.getByText("ABCD2345")).toBeInTheDocument();
  expect(screen.getByText(/코드는 그대로 보입니다/)).toBeInTheDocument();
});

test("늦게 도착한 이전 명단 응답이 더 최근 명단을 덮지 않습니다", async () => {
  await renderWithOpenWindow();
  let resolveStale!: (rows: attendance.AdminAttendance[]) => void;
  vi.mocked(attendance.getAdminAttendance)
    .mockReturnValueOnce(new Promise((resolve) => { resolveStale = resolve; }))
    .mockResolvedValueOnce([{ ...sora, status: "CHECKED_IN" }]);

  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  expect(await screen.findByText(/출석 완료/)).toBeInTheDocument();
  await act(async () => { resolveStale([{ ...sora, status: "NOT_OPEN" }]); });

  expect(screen.getByText(/출석 완료/)).toBeInTheDocument();
  expect(screen.queryByText(/출석 창 대기/)).toBeNull();
});

test("늦게 실패한 이전 명단 요청은 더 최근 성공을 오류로 덮지 않습니다", async () => {
  await renderWithOpenWindow();
  let rejectStale!: (error: Error) => void;
  vi.mocked(attendance.getAdminAttendance)
    .mockReturnValueOnce(new Promise((_, reject) => { rejectStale = reject; }))
    .mockResolvedValueOnce([{ ...sora, status: "CHECKED_IN" }]);

  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  expect(await screen.findByText(/출석 완료/)).toBeInTheDocument();
  await act(async () => { rejectStale(new Error("늦은 실패")); });

  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("ABCD2345")).toBeInTheDocument();
});

test("명단 요청이 멈춰 있어도 유효 시간이 지나면 바로 QR과 코드를 거둡니다", async () => {
  await renderWithOpenWindow();
  vi.mocked(attendance.getAdminAttendance).mockReturnValue(new Promise(() => undefined));

  await act(() => vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000));

  expect(screen.getByText(/연습이 끝나 출석 창을 열 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByText("ABCD2345")).toBeNull();
});

test("명단 자동 갱신은 이전 요청이 끝난 뒤에야 다음 요청을 보냅니다", async () => {
  await renderWithOpenWindow();
  vi.mocked(attendance.getAdminAttendance).mockReturnValue(new Promise(() => undefined));
  const before = vi.mocked(attendance.getAdminAttendance).mock.calls.length;

  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(vi.mocked(attendance.getAdminAttendance).mock.calls.length).toBe(before + 1);
  await act(() => vi.advanceTimersByTimeAsync(45000));
  expect(vi.mocked(attendance.getAdminAttendance).mock.calls.length).toBe(before + 1);
});

test("늦게 실패한 이전 다시 불러오기는 더 최근 실패의 안내를 지우지 않습니다", async () => {
  await renderWithOpenWindow();
  let rejectStale!: (error: Error) => void;
  vi.mocked(attendance.getAdminAttendance)
    .mockReturnValueOnce(new Promise((_, reject) => { rejectStale = reject; }))
    .mockRejectedValueOnce(new Error("최근 실패"));

  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 불러오기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("출석 목록을 새로고침하지 못했습니다.");
  await act(async () => { rejectStale(new Error("늦은 실패")); });

  expect(screen.getByRole("alert")).toHaveTextContent("출석 목록을 새로고침하지 못했습니다.");
});

test("열 수 있는 시각 전에는 출석 받기 버튼을 끄고 시각을 알려 줍니다", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-28T07:00:00Z"));
  vi.mocked(events.getEvent).mockResolvedValue({ ...rehearsal, startAt: "2026-10-28T10:00:00Z", endAt: "2026-10-28T12:00:00Z" });
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: "2026-10-28T12:00:00Z", open: false,
    code: null, opensAt: "2026-10-28T09:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  const button = await screen.findByRole("button", { name: "출석 받기" });
  expect(button).toBeDisabled();
  expect(screen.getByText(/부터 열 수 있습니다/)).toBeInTheDocument();
});

test("열린 창의 코드는 새로고침 뒤에도 서버에서 받아 보여 줍니다", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: 7, expiresAt: "2026-09-27T12:00:00Z", open: true,
    code: "0427", opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([]);
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  expect(await screen.findByText("0427")).toBeInTheDocument();
  expect(screen.getByText(/연습 끝 .*까지/)).toBeInTheDocument();
});

test("한 단원을 저장하는 동안 다음 단원을 이어서 정정하고, 실패는 그 단원에만 보입니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "MISSED" },
    { memberId: 12, name: "이하늘", part: null, cohort: null, status: "MISSED", checkedInAt: null, correctedAt: null }]);
  let finishSora!: () => void;
  vi.mocked(attendance.correctAttendance)
    .mockReturnValueOnce(new Promise<void>((resolve) => { finishSora = resolve; }))
    .mockRejectedValueOnce(new ApiRequestError(409, "ATTENDANCE_UNCHANGED", "출석 상태가 이미 같습니다."));
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  fireEvent.click(await screen.findByRole("button", { name: /^김소라/ }));
  fireEvent.change(screen.getByLabelText("김소라 정정 이유"), { target: { value: "지각 확인" } });
  fireEvent.click(screen.getByRole("button", { name: "김소라 출석으로 정정" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "김소라 출석으로 정정" })).toBeDisabled());

  fireEvent.click(screen.getByRole("button", { name: /^이하늘/ }));
  fireEvent.change(screen.getByLabelText("이하늘 정정 이유"), { target: { value: "현장 확인" } });
  const haneul = screen.getByRole("button", { name: "이하늘 출석으로 정정" });
  expect(haneul).toBeEnabled();
  fireEvent.click(haneul);
  expect(await screen.findByRole("alert")).toHaveTextContent("출석 상태가 이미 같습니다.");
  expect(screen.getByLabelText("이하늘 정정 이유")).toHaveValue("현장 확인");

  await act(async () => { finishSora(); });
  expect(screen.getByRole("alert")).toHaveTextContent("출석 상태가 이미 같습니다.");
  fireEvent.click(screen.getByRole("button", { name: /^김소라/ }));
  expect(screen.getByLabelText("김소라 정정 이유")).toHaveValue("");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(attendance.correctAttendance).toHaveBeenCalledTimes(2);
});

test("단원 행에 출석 시각과 정정 표시를 붙이고 지각으로 정정할 수 있습니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([
    { memberId: 1, name: "박예영", part: "ALTO", cohort: 2, status: "LATE", checkedInAt: "2026-10-28T09:21:00Z", correctedAt: null },
    { memberId: 2, name: "최재원", part: null, cohort: null, status: "MISSED", checkedInAt: null, correctedAt: "2026-10-28T11:00:00Z" },
  ]);
  vi.mocked(attendance.correctAttendance).mockResolvedValue();
  renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));

  expect(await screen.findByText("지각")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^박예영/ }));
  // Node의 ICU는 "PM 6:21", 브라우저는 "오후 6:21"로 그리므로 시각 부분만 봅니다.
  expect(screen.getByText(/6:21/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^최재원/ }));
  expect(screen.getByText("정정됨")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("최재원 정정 이유"), { target: { value: "늦게 옴" } });
  fireEvent.click(screen.getByRole("button", { name: "최재원 지각으로 정정" }));
  await waitFor(() => expect(attendance.correctAttendance).toHaveBeenCalledWith(3, 2, "LATE", "늦게 옴"));
});

test("좁은 화면에서는 단원을 고르면 상세로, 목록으로 돌아가면 그 단원 행으로 초점을 옮깁니다", async () => {
  vi.mocked(events.getEvent).mockResolvedValue(rehearsal);
  vi.mocked(attendance.getCheckInSession).mockResolvedValue({ sessionId: null, expiresAt: null, open: false, code: null, opensAt: "2026-09-27T08:30:00Z" });
  vi.mocked(attendance.getAdminAttendance).mockResolvedValue([{ ...sora, status: "MISSED" }]);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  try {
    renderWithSession(<AdminAttendancePanel eventId={3} />, sessionFixture({ admin: true }));
    const row = await screen.findByRole("button", { name: /^김소라/ });
    fireEvent.click(row);
    expect(document.activeElement).toContainElement(screen.getByLabelText("김소라 정정 이유"));
    fireEvent.click(screen.getByRole("button", { name: "목록으로" }));
    expect(screen.getByRole("button", { name: /^김소라/ })).toHaveFocus();
  } finally { vi.unstubAllGlobals(); }
});
