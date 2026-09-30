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
  vi.mocked(attendance.getEventAttendance).mockReset();
  vi.mocked(attendance.submitCheckIn).mockReset();
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: false });
  window.history.replaceState(null, "", "/events/3/check-in");
});
afterEach(cleanup);

test("QR 토큰을 주소에서 즉시 지우고 본문으로 제출합니다", async () => {
  window.history.replaceState(null, "", "/events/3/check-in#token=secret-token");
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance)
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "CHECKED_IN", checkInOpen: false });
  render(<CheckInPanel eventId={3} />);
  expect(window.location.hash).toBe("");
  await waitFor(() => expect(attendance.submitCheckIn).toHaveBeenCalledWith(3, "secret-token"));
  expect(attendance.getEventAttendance).toHaveBeenCalledTimes(1);
  await screen.findByText("출석 완료", { selector: "strong" });
});

test("개발 모드의 이중 효과 실행에서도 QR 출석을 한 번 제출합니다", async () => {
  window.history.replaceState(null, "", "/events/3/check-in#token=secret-token");
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance).mockResolvedValue({ eventId: 3, eventTitle: "연습", status: "CHECKED_IN", checkInOpen: false });
  render(<StrictMode><CheckInPanel eventId={3} /></StrictMode>);
  await waitFor(() => expect(attendance.submitCheckIn).toHaveBeenCalledTimes(1));
  expect(window.location.hash).toBe("");
});

test("이미 열린 행사 화면에서 QR 해시로 이동하면 주소를 지우고 출석합니다", async () => {
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  vi.mocked(attendance.getEventAttendance)
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: false })
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "CHECKED_IN", checkInOpen: false });
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
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "NOT_OPEN", checkInOpen: false })
    .mockRejectedValueOnce(new Error("조회 실패"))
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "CHECKED_IN", checkInOpen: false });
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
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "CHECKED_IN", checkInOpen: false });
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
    .mockResolvedValueOnce({ eventId: 3, eventTitle: "연습", status: "CHECKED_IN", checkInOpen: false });
  vi.mocked(attendance.submitCheckIn).mockResolvedValue();
  render(<CheckInPanel eventId={3} />);
  fireEvent.change(screen.getByLabelText("운영진이 알려준 출석 코드"), { target: { value: "ABCD2345" } });
  fireEvent.click(screen.getByRole("button", { name: "출석하기" }));
  await screen.findByText("출석이 완료되었습니다.");
  rejectInitial(new Error("오래된 조회 실패"));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("출석이 완료되었습니다."));
});

test.each([
  ["SESSION_CLOSED", "출석 창이 닫혔거나 유효 시간이 지났습니다."],
  ["ALREADY_CHECKED_IN", "이미 출석이 처리되었습니다."],
  ["NOT_ELIGIBLE", "이 행사의 출석 대상이 아닙니다."],
  ["APPROVAL_REQUIRED", "가입 승인 후 출석할 수 있습니다."],
])("%s 오류를 구분해 안내합니다", async (code, message) => {
  vi.mocked(attendance.submitCheckIn).mockRejectedValue(new ApiRequestError(409, code, "실패"));
  render(<CheckInPanel eventId={3} />);
  fireEvent.change(screen.getByLabelText("운영진이 알려준 출석 코드"), { target: { value: "ABCD2345" } });
  fireEvent.click(screen.getByRole("button", { name: "출석하기" }));
  await screen.findByText(message);
});
