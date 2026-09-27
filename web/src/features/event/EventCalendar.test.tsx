import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCalendar } from "./EventCalendar";

const getSession = vi.fn();
const getEvents = vi.fn();
const getNotices = vi.fn();
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../auth/session", () => ({ getSession: () => getSession() }));
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
}));
vi.mock("../notice/notices", () => ({ getNotices: (...args: unknown[]) => getNotices(...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("일정 중심 회원 화면", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    getSession.mockReset();
    getEvents.mockReset();
    getNotices.mockReset();
    router.replace.mockReset();
    getSession.mockResolvedValue({ status: "APPROVED", memberType: "OB", name: "단원" });
    getEvents.mockResolvedValue([
      { id: 1, title: "정기 연습", description: "연습실", startAt: "2026-09-29T10:00:00Z", endAt: "2026-09-29T12:00:00Z", obEligible: false, publicVisible: false },
      { id: 2, title: "가을 공연", description: "공연장", startAt: "2026-09-30T10:00:00Z", endAt: "2026-09-30T12:00:00Z", obEligible: true, publicVisible: false },
    ]);
    getNotices.mockResolvedValue({ items: [{ id: 9, title: "공연 안내", publishedAt: "2026-09-20T00:00:00Z" }], page: 0, size: 20, total: 1 });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("날짜를 고르면 해당 행사 상세와 OB 출석 대상 여부를 표시한다", async () => {
    render(<EventCalendar />);
    await screen.findByRole("button", { name: /29일/ });
    fireEvent.click(screen.getByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    expect(screen.getByText("OB 출석 대상이 아닙니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /30일/ }));
    expect(await screen.findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(screen.getByText("OB 출석 대상 행사입니다.")).toBeInTheDocument();
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
    expect(screen.getByText("공연 안내")).toBeInTheDocument();
  });

  it("승인 대기 계정은 회원 자료를 요청하지 않고 신청 상태로 이동한다", async () => {
    getSession.mockResolvedValue({ status: "APPROVAL_PENDING", memberType: null, name: "신청자" });
    render(<EventCalendar />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/application-status"));
    expect(getEvents).not.toHaveBeenCalled();
    expect(getNotices).not.toHaveBeenCalled();
  });
});
