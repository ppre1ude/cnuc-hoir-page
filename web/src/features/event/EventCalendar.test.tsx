import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCalendar } from "./EventCalendar";

const getSession = vi.fn();
const getEvents = vi.fn();
const getMyEventRsvps = vi.fn();
const setEventRsvp = vi.fn();
const getNotices = vi.fn();
const getEventAttendance = vi.fn();
const getMyAttendance = vi.fn();
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../auth/session", () => ({ getSession: () => getSession() }));
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
  getMyEventRsvps: (...args: unknown[]) => getMyEventRsvps(...args),
  setEventRsvp: (...args: unknown[]) => setEventRsvp(...args),
}));
vi.mock("../notice/notices", () => ({ getNotices: (...args: unknown[]) => getNotices(...args) }));
vi.mock("../attendance/attendance", async (importOriginal) => ({
  ...await importOriginal<typeof import("../attendance/attendance")>(),
  getEventAttendance: (...args: unknown[]) => getEventAttendance(...args),
  getMyAttendance: (...args: unknown[]) => getMyAttendance(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("일정 중심 회원 화면", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    getSession.mockReset();
    getEvents.mockReset(); getMyEventRsvps.mockReset(); setEventRsvp.mockReset();
    getNotices.mockReset();
    getEventAttendance.mockReset();
    getMyAttendance.mockReset();
    router.replace.mockReset();
    getSession.mockResolvedValue({ status: "APPROVED", memberType: "OB", name: "단원" });
    getEvents.mockResolvedValue([
      { id: 1, title: "정기 연습", description: "연습실", startAt: "2026-09-29T10:00:00Z", endAt: "2026-09-29T12:00:00Z", obEligible: false, publicVisible: false },
      { id: 2, title: "가을 공연", description: "공연장", startAt: "2026-09-30T10:00:00Z", endAt: "2026-09-30T12:00:00Z", obEligible: true, publicVisible: false },
    ]);
    getNotices.mockResolvedValue({ items: [{ id: 9, title: "공연 안내", publishedAt: "2026-09-20T00:00:00Z" }], page: 0, size: 20, total: 1 });
    getMyAttendance.mockResolvedValue([]);
    getMyEventRsvps.mockResolvedValue([]);
    setEventRsvp.mockImplementation(async (id: number, choice: string) => ({ eventId: id, choice }));
    getEventAttendance.mockImplementation(async (id: number) => ({
      eventId: id, eventTitle: "행사", status: "NOT_OPEN", checkInOpen: id === 2,
    }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("날짜를 고르면 해당 행사 상세와 OB 출석 대상 여부를 표시한다", async () => {
    render(<EventCalendar />);
    await screen.findByRole("button", { name: /29일/ });
    fireEvent.click(screen.getByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    expect(screen.getByText("OB 참여 불가")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /30일/ }));
    expect(await screen.findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(screen.getByText("OB 참여 가능")).toBeInTheDocument();
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));
  });

  it("달력, 선택 행사, 최근 공지, 출석 요약 순서로 배치한다", async () => {
    render(<EventCalendar />);
    const calendar = await screen.findByRole("region", { name: "행사 달력" });
    const detail = screen.getByRole("region", { name: "선택한 행사" });
    const notices = screen.getByRole("region", { name: "최근 공지" });
    const attendance = screen.getByRole("region", { name: "내 출석 요약" });
    expect(calendar.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detail.compareDocumentPosition(notices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notices.compareDocumentPosition(attendance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByText("공연 안내")).toBeInTheDocument();
  });

  it("출석 창이 열린 대상 행사에서만 참여 경로를 보여준다", async () => {
    render(<EventCalendar />);
    fireEvent.click(await screen.findByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /30일/ }));
    expect(await screen.findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/2/check-in");
  });

  it("월간 행사 목록에서 상세를 열지 않고 참석 의사를 바꾼다", async () => {
    getSession.mockResolvedValue({ status: "APPROVED", memberType: "ACTIVE", name: "단원" });
    render(<EventCalendar />);
    fireEvent.click(await screen.findByRole("button", { name: "가을 공연 참석" }));
    await waitFor(() => expect(setEventRsvp).toHaveBeenCalledWith(2, "ATTENDING"));
    expect(await screen.findByRole("button", { name: "가을 공연 참석" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "가을 공연 불참" }));
    await waitFor(() => expect(setEventRsvp).toHaveBeenCalledWith(2, "ABSENT"));
  });

  it("승인 대기 계정은 회원 자료를 요청하지 않고 신청 상태로 이동한다", async () => {
    getSession.mockResolvedValue({ status: "APPROVAL_PENDING", memberType: null, name: "신청자" });
    render(<EventCalendar />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/application-status"));
    expect(getEvents).not.toHaveBeenCalled();
    expect(getNotices).not.toHaveBeenCalled();
  });

  it("공지 조회가 실패해도 행사를 탐색하고 공지만 다시 불러온다", async () => {
    getNotices.mockRejectedValueOnce(new Error("공지 장애"));
    render(<EventCalendar />);
    fireEvent.click(await screen.findByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    const noticeRegion = screen.getByRole("region", { name: "최근 공지" });
    expect(within(noticeRegion).getByRole("alert")).toHaveTextContent("공지를 불러오지 못했습니다.");
    fireEvent.click(within(noticeRegion).getByRole("button", { name: "다시 시도" }));
    expect(await within(noticeRegion).findByText("공연 안내")).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledTimes(1);
  });
});
