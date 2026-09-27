import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEditor } from "./EventEditor";

const getSession = vi.fn();
const getEvents = vi.fn();
const updateEvent = vi.fn();
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../auth/session", () => ({ getSession: () => getSession() }));
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
  updateEvent: (...args: unknown[]) => updateEvent(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const septemberEvent = {
  id: 1, title: "정기 연습", description: "연습실", startAt: "2026-09-20T10:00:00Z",
  endAt: "2026-09-20T12:00:00Z", obEligible: false, publicVisible: false,
};
const octoberEvent = {
  ...septemberEvent, id: 2, title: "가을 공연", startAt: "2026-10-20T10:00:00Z", endAt: "2026-10-20T12:00:00Z",
};

describe("운영진 행사 편집", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    getSession.mockReset(); getEvents.mockReset(); updateEvent.mockReset(); router.replace.mockReset();
    getSession.mockResolvedValue({ status: "APPROVED", admin: true });
    updateEvent.mockResolvedValue(septemberEvent);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("저장 뒤 이전 월 응답이 늦게 도착해도 현재 조회 월 목록을 유지한다", async () => {
    let finishOldMonth!: (events: typeof septemberEvent[]) => void;
    const oldMonthRefresh = new Promise<typeof septemberEvent[]>((resolve) => { finishOldMonth = resolve; });
    getEvents.mockResolvedValueOnce([septemberEvent])
      .mockReturnValueOnce(oldMonthRefresh)
      .mockResolvedValueOnce([octoberEvent]);
    render(<EventEditor />);
    fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("조회 월"), { target: { value: "2026-10" } });
    expect(await screen.findByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
    await act(async () => { finishOldMonth([septemberEvent]); });
    expect(screen.getByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
    expect(screen.queryByText("행사를 불러오는 중입니다.")).not.toBeInTheDocument();
  });
});
