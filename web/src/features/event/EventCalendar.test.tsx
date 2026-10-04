import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCalendar } from "./EventCalendar";
import { renderWithSession, sessionFixture } from "../../test/session";

const ob = sessionFixture({ memberType: "OB" });
const getEvents = vi.fn();
const getMyEventRsvps = vi.fn();
const setEventRsvp = vi.fn();
const getNotices = vi.fn();
const getEventAttendance = vi.fn();
const getMyAttendance = vi.fn();
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

describe("일정 중심 회원 화면", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    getEvents.mockReset(); getMyEventRsvps.mockReset(); setEventRsvp.mockReset();
    getNotices.mockReset();
    getEventAttendance.mockReset();
    getMyAttendance.mockReset();
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
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("달력을 요일 머리글이 있는 표로 표시하고 오늘과 선택 날짜를 구분한다", async () => {
    renderWithSession(<EventCalendar />, ob);
    expect(screen.getByRole("table", { name: "2026년 09월" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getByRole("button", { name: /27일/ })).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("button", { name: /27일/ })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("link", { name: "공연 안내" })).toHaveAttribute("href", "/notices?notice=9");
  });

  it("일정과 출석을 조회하는 동안 빈 기록으로 잘못 안내하지 않는다", () => {
    getEvents.mockReturnValue(new Promise(() => {}));
    getMyAttendance.mockReturnValue(new Promise(() => {}));
    renderWithSession(<EventCalendar />, ob);
    expect(screen.getByText("일정을 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByText("일정 없음")).not.toBeInTheDocument();
    expect(screen.queryByText("등록된 행사가 없습니다.")).not.toBeInTheDocument();
    expect(screen.queryByText("출석 기록이 없습니다.")).not.toBeInTheDocument();
  });

  it("날짜를 고르면 해당 행사 상세와 OB 출석 대상 여부를 표시한다", async () => {
    renderWithSession(<EventCalendar />, ob);
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
    renderWithSession(<EventCalendar />, ob);
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
    renderWithSession(<EventCalendar />, ob);
    fireEvent.click(await screen.findByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /30일/ }));
    expect(await screen.findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/2/check-in");
  });

  it("월간 행사 목록에서 상세를 열지 않고 참석 의사를 바꾼다", async () => {
    renderWithSession(<EventCalendar />, sessionFixture({ memberType: "ACTIVE" }));
    fireEvent.click(await screen.findByRole("button", { name: "가을 공연 참석" }));
    await waitFor(() => expect(setEventRsvp).toHaveBeenCalledWith(2, "ATTENDING"));
    expect(await screen.findByRole("button", { name: "가을 공연 참석" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "가을 공연 불참" }));
    await waitFor(() => expect(setEventRsvp).toHaveBeenCalledWith(2, "ABSENT"));
  });

  it("달을 바꾸면 행사만 다시 받고 세션은 다시 받지 않는다", async () => {
    // 행사·공지·출석 요청은 모두 목이므로 fetch가 불리면 세션 요청입니다.
    const fetch = vi.spyOn(globalThis, "fetch");
    renderWithSession(<EventCalendar />, ob);
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("table", { name: "2026년 10월" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("공지 조회가 실패해도 행사를 탐색하고 공지만 다시 불러온다", async () => {
    getNotices.mockRejectedValueOnce(new Error("공지 장애"));
    renderWithSession(<EventCalendar />, ob);
    fireEvent.click(await screen.findByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    const noticeRegion = screen.getByRole("region", { name: "최근 공지" });
    expect(within(noticeRegion).getByRole("alert")).toHaveTextContent("공지를 불러오지 못했습니다.");
    fireEvent.click(within(noticeRegion).getByRole("button", { name: "다시 시도" }));
    expect(await within(noticeRegion).findByText("공연 안내")).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledTimes(1);
  });
});
