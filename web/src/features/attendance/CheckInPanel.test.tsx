import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { ApiRequestError } from "../../lib/api";
import { CheckInPanel } from "./CheckInPanel";
import * as attendance from "./attendance";

vi.mock("./attendance", async (importOriginal) => {
  const original = await importOriginal<typeof attendance>();
  return { ...original, getEventAttendance: vi.fn(), submitCheckIn: vi.fn() };
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T08:00:00Z"));
  vi.mocked(attendance.getEventAttendance).mockReset();
  vi.mocked(attendance.submitCheckIn).mockReset();
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: false });
  window.history.replaceState(null, "", "/events/3/check-in");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

test("출석 창이 열려 있고 아직 출석하지 않았으면 출석 전으로 보입니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T07:50:00Z",
    status: "NOT_OPEN", checkInOpen: true });
  render(<CheckInPanel eventId={3} />);
  expect(await screen.findByText("출석 전")).toBeInTheDocument();
});

test("코드 입력칸은 숫자 4자리만 받고 지각 상태에서도 잠깁니다", async () => {
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T07:30:00Z",
    status: "LATE", checkInOpen: true });
  render(<CheckInPanel eventId={3} />);
  expect(await screen.findByText("지각")).toBeInTheDocument();
  const input = screen.getByLabelText("운영진이 알려준 출석 코드");
  expect(input).toHaveAttribute("maxlength", "4");
  expect(input).toHaveAttribute("inputmode", "numeric");
  expect(input).toBeDisabled();
});

test("QR 토큰을 주소에서 즉시 지우고 본문으로 제출합니다", async () => {
  window.history.replaceState(null, "", "/events/3/check-in#token=secret-token");
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance)
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "CHECKED_IN", checkInOpen: false });
  render(<CheckInPanel eventId={3} />);
  expect(window.location.hash).toBe("");
  await waitFor(() => expect(attendance.submitCheckIn).toHaveBeenCalledWith(3, "secret-token"));
  expect(attendance.getEventAttendance).toHaveBeenCalledTimes(1);
  await screen.findByText("출석 완료");
});

test("개발 모드의 이중 효과 실행에서도 QR 출석을 한 번 제출합니다", async () => {
  window.history.replaceState(null, "", "/events/3/check-in#token=secret-token");
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "CHECKED_IN", checkInOpen: false });
  render(<StrictMode><CheckInPanel eventId={3} /></StrictMode>);
  await waitFor(() => expect(attendance.submitCheckIn).toHaveBeenCalledTimes(1));
  expect(window.location.hash).toBe("");
});

test("이미 열린 행사 화면에서 QR 해시로 이동하면 주소를 지우고 출석합니다", async () => {
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance)
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: false })
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "CHECKED_IN", checkInOpen: false });
  render(<CheckInPanel eventId={3} />);
  await screen.findByText("출석 창 대기");
  window.location.hash = "#token=later-token";
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  expect(window.location.hash).toBe("");
  await waitFor(() => expect(attendance.submitCheckIn).toHaveBeenCalledTimes(1));
  expect(attendance.submitCheckIn).toHaveBeenCalledWith(3, "later-token");
  await screen.findByText("출석 완료");
});

test("입력 코드 제출 성공 뒤 상태 조회가 실패하면 조회만 재시도합니다", async () => {
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance)
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "NOT_OPEN", checkInOpen: false })
    .mockRejectedValueOnce(new Error("조회 실패"))
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "CHECKED_IN", checkInOpen: false });
  render(<CheckInPanel eventId={3} />);
  await screen.findByText("출석 창 대기");
  fireEvent.change(screen.getByLabelText("운영진이 알려준 출석 코드"), { target: { value: "ABCD2345" } });
  fireEvent.click(screen.getByRole("button", { name: "출석하기" }));
  await screen.findByText("출석은 완료됐지만 상태를 확인하지 못했습니다.");
  expect(screen.getByRole("button", { name: "출석하기" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "상태 다시 확인" }));
  await screen.findByText("출석 완료");
  expect(attendance.submitCheckIn).toHaveBeenCalledTimes(1);
});

test("QR 제출 성공 뒤 상태 조회만 실패해도 출석 완료를 유지합니다", async () => {
  window.history.replaceState(null, "", "/events/3/check-in#token=secret-token");
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance)
    .mockRejectedValueOnce(new Error("조회 실패"))
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "CHECKED_IN", checkInOpen: false });
  render(<CheckInPanel eventId={3} />);
  await screen.findByText("출석은 완료됐지만 상태를 확인하지 못했습니다.");
  fireEvent.click(screen.getByRole("button", { name: "상태 다시 확인" }));
  await screen.findByText("출석 완료");
  expect(attendance.submitCheckIn).toHaveBeenCalledTimes(1);
});

test("코드 제출 전 시작된 상태 조회 오류가 출석 성공 안내를 덮지 않습니다", async () => {
  let rejectInitial!: (error: Error) => void;
  const initial = new Promise<attendance.AttendanceState>((_, reject) => { rejectInitial = reject; });
  vi.mocked(attendance.getEventAttendance)
    .mockReturnValueOnce(initial)
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", startAt: "2026-09-27T09:00:00Z", status: "CHECKED_IN", checkInOpen: false });
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  render(<CheckInPanel eventId={3} />);
  fireEvent.change(screen.getByLabelText("운영진이 알려준 출석 코드"), { target: { value: "ABCD2345" } });
  fireEvent.click(screen.getByRole("button", { name: "출석하기" }));
  await screen.findByText("출석이 완료되었습니다.");
  rejectInitial(new Error("오래된 조회 실패"));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("출석이 완료되었습니다."));
});

test.each([
  ["SESSION_CLOSED", "출석 창이 열리지 않았거나 연습이 끝났습니다."],
  ["ALREADY_CHECKED_IN", "이미 출석이 처리되었습니다."],
  ["NOT_ELIGIBLE", "이 일정의 출석 대상이 아닙니다."],
  ["APPROVAL_REQUIRED", "가입 승인 후 출석할 수 있습니다."],
])("%s 오류를 구분해 안내합니다", async (code, message) => {
  vi.mocked(attendance.submitCheckIn).mockRejectedValue(new ApiRequestError(409, code, "실패"));
  render(<CheckInPanel eventId={3} />);
  fireEvent.change(screen.getByLabelText("운영진이 알려준 출석 코드"), { target: { value: "ABCD2345" } });
  fireEvent.click(screen.getByRole("button", { name: "출석하기" }));
  await screen.findByText(message);
});

test("잘못된 출석 코드의 오류를 입력과 연결하고 수정하면 오류 표시를 해제합니다", async () => {
  vi.mocked(attendance.submitCheckIn).mockRejectedValue(new ApiRequestError(400, "INVALID_CREDENTIAL", "실패"));
  render(<CheckInPanel eventId={3} />);
  const input = screen.getByLabelText("운영진이 알려준 출석 코드");
  fireEvent.change(input, { target: { value: "BADCODE" } });
  fireEvent.click(screen.getByRole("button", { name: "출석하기" }));
  await screen.findByText("출석 코드를 확인해 주세요.");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("출석 코드를 확인해 주세요.");
  fireEvent.change(input, { target: { value: "ABCD2345" } });
  expect(input).not.toHaveAttribute("aria-invalid");
});

test("제목에 일정 이름을 쓰고 위쪽에 일정으로 돌아가는 링크를 둡니다", async () => {
  render(<CheckInPanel eventId={3} />);
  expect(await screen.findByRole("heading", { level: 1, name: "연습 출석" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← 일정" })).toHaveAttribute("href", "/events/3");
});

test("코드를 확인하는 동안 입력 칸의 초점을 지키고 틀리면 글자를 선택해 바로 고치게 합니다", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(attendance.submitCheckIn).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  render(<CheckInPanel eventId={3} />);
  const input = screen.getByLabelText<HTMLInputElement>("운영진이 알려준 출석 코드");
  expect(input).toHaveAttribute("enterkeyhint", "go");
  input.focus();
  fireEvent.change(input, { target: { value: "BADCODE" } });
  fireEvent.submit(input.form!);
  expect(input).toBeEnabled();
  expect(input).toHaveAttribute("readonly");
  expect(input).toHaveFocus();
  reject(new ApiRequestError(400, "INVALID_CREDENTIAL", "실패"));
  await screen.findByText("출석 코드를 확인해 주세요.");
  expect(input).toHaveFocus();
  expect(input).not.toHaveAttribute("readonly");
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, "BADCODE".length]);
});
