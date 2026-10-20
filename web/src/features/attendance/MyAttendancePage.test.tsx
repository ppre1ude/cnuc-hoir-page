import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MyAttendancePage } from "./MyAttendancePage";
const getMyAttendance = vi.fn();
vi.mock("./attendance", async (original) => ({ ...await original<typeof import("./attendance")>(), getMyAttendance: () => getMyAttendance() }));
beforeEach(() => { getMyAttendance.mockReset(); });
afterEach(cleanup);

test("조회가 끝나기 전에는 출석 기록이 없다고 표시하지 않는다", () => {
  getMyAttendance.mockReturnValue(new Promise(() => {}));
  render(<MyAttendancePage />);
  expect(screen.getByRole("status")).toHaveTextContent("출석 기록을 불러오는 중입니다.");
  expect(screen.queryByText("출석 기록이 없습니다.")).not.toBeInTheDocument();
});

test("조회 실패 후 재시도하면 행사 링크와 실제 출석 상태를 표시한다", async () => {
  getMyAttendance.mockRejectedValueOnce(new Error("조회 실패")).mockResolvedValueOnce([
    { eventId: 3, eventTitle: "정기 연습", startAt: "2026-09-20T09:00:00Z", status: "MISSED", checkInOpen: false },
  ]);
  render(<MyAttendancePage />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByRole("link", { name: /정기 연습.*미출석/ })).toHaveAttribute("href", "/events/3");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("기록 없이 지난 행사는 출석 창을 기다린다고 하지 않는다", async () => {
  getMyAttendance.mockResolvedValue([{ eventId: 4, eventTitle: "지난 공연", startAt: "2026-09-13T09:00:00Z", status: "NOT_OPEN", checkInOpen: false }]);
  render(<MyAttendancePage />);
  expect(await screen.findByRole("link", { name: /지난 공연.*출석 기록 없음/ })).toBeInTheDocument();
  expect(screen.queryByText("출석 창 대기")).not.toBeInTheDocument();
});

test("같은 제목의 연습을 서울 기준 날짜와 요일로 구분한다", async () => {
  getMyAttendance.mockResolvedValue([
    { eventId: 6, eventTitle: "정기 연습", startAt: "2026-09-19T16:00:00Z", status: "CHECKED_IN", checkInOpen: false },
    { eventId: 5, eventTitle: "정기 연습", startAt: "2026-09-13T09:00:00Z", status: "MISSED", checkInOpen: false },
  ]);
  render(<MyAttendancePage />);
  expect(await screen.findByRole("link", { name: /09\.20 \(일\).*정기 연습.*출석 완료/ })).toHaveAttribute("href", "/events/6");
  expect(screen.getByRole("link", { name: /09\.13 \(일\).*정기 연습.*미출석/ })).toHaveAttribute("href", "/events/5");
});
